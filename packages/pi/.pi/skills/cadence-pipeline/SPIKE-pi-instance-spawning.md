# Spike: How Can Pi Spawn and Orchestrate Multiple Agent Instances?

**Timebox**: 4 hours
**Story**: (upcoming `cadence-pipeline` feature)
**Status**: In Progress

## Question

How can a Pi extension (or skill) programmatically create and manage additional Pi agent instances to enable parallel story execution? What are the viable approaches, their trade-offs, and which should we recommend for the `cadence-pipeline` feature?

**Sub-questions:**
1. Can an extension spawn new Pi sessions and drive them via RPC?
2. Can an extension use the Pi SDK (`createAgentSession`) directly from within a running Pi instance?
3. Can we launch separate terminal windows with their own `pi` processes?
4. How do we coordinate state between instances using the Obsidian vault?
5. How do we handle compaction, error recovery, and cancellation?

## Approach

1. Analyze Pi's three programmatic interfaces: CLI flags, RPC mode, SDK
2. Evaluate each for suitability as a "sub-agent" spawned by a Pi extension
3. Investigate terminal window launching on Windows (current OS)
4. Design the coordination model (orchestrator ↔ worker communication)
5. Produce a recommendation with a concrete implementation sketch

---

## Findings

### 1. Pi's Three Programmatic Interfaces

Pi exposes three ways to drive it programmatically:

| Interface | How | Headless? | Bi-directional? | In-process? |
|-----------|-----|-----------|-----------------|-------------|
| **CLI** (`pi -p "msg"`) | Subprocess | Yes | No (fire-and-forget) | No |
| **RPC mode** (`pi --mode rpc`) | Subprocess with JSONL over stdin/stdout | Yes | Yes | No |
| **SDK** (`createAgentSession()`) | Direct TypeScript API | Yes | Yes (events) | Yes |

### 2. Option A: RPC Mode (Subprocess per worker)

**How it works:**
- The orchestrator extension spawns child processes: `pi --mode rpc --no-session --cwd <worktree-dir>`
- Communication via JSONL on stdin/stdout — send `prompt` commands, receive `agent_start`/`agent_end`/`tool_execution_*` events
- Each worker gets its own process, own context window, own session lifecycle

**Pros:**
- **Process isolation** — a worker crash doesn't take down the orchestrator
- **Full Pi feature set** — workers get extensions, skills, prompts, the lot (auto-discovered from `cwd` and `~/.pi/agent/`)
- **Observable** — the orchestrator can stream `tool_execution_update` events to show progress in the main console
- **No import issues** — no need to import `@mariozechner/pi-coding-agent` inside an extension
- **Proven protocol** — RPC mode is documented, has a typed client (`rpc-client.ts`), and is used in production

**Cons:**
- **Latency** — each worker boots a fresh Pi process (model loading, extension init)
- **API key duplication** — each process reads `~/.pi/agent/auth.json` independently (works, but burns API quota in parallel)
- **No shared memory** — coordination must be through the filesystem (vault files, git state)
- **Resource usage** — each process has its own LLM context window (N workers = N × context tokens consumed)

**Implementation sketch:**
```typescript
import { spawn, type ChildProcess } from "child_process";

interface Worker {
  process: ChildProcess;
  storyName: string;
  status: "starting" | "working" | "reviewing" | "done" | "failed";
}

function spawnWorker(storyName: string, worktreeDir: string): Worker {
  const proc = spawn("pi", [
    "--mode", "rpc",
    "--no-session",
    "--cwd", worktreeDir,
  ], { stdio: ["pipe", "pipe", "pipe"] });

  // Attach JSONL reader to stdout
  attachJsonlReader(proc.stdout!, (event) => {
    handleWorkerEvent(worker, event);
  });

  // Send initial prompt to start the cadence-pickup flow
  sendCommand(proc, {
    type: "prompt",
    message: `/skill:cadence-pickup ${storyName}`,
  });

  return { process: proc, storyName, status: "starting" };
}
```

### 3. Option B: SDK In-Process (createAgentSession)

**How it works:**
- The orchestrator extension imports `createAgentSession` from `@mariozechner/pi-coding-agent`
- Creates multiple `AgentSession` instances in the same Node.js process
- Each session has its own message history, model, and tool routing

**Pros:**
- **Fast startup** — no subprocess boot time, reuse already-loaded model registry and auth
- **Shared event bus** — `createEventBus()` allows cross-session communication
- **Lower resource overhead** — one process, shared extensions loader
- **Type-safe** — full TypeScript API, no JSONL parsing

**Cons:**
- **CRITICAL: Single event loop** — all sessions share one Node.js process. While one session is streaming an LLM response, others may be blocked on tool execution callbacks
- **Extension conflict** — extensions register global state (commands, tools, event handlers). Multiple sessions in one process may interfere with each other's extension state
- **Crash propagation** — one bad tool call could crash the entire process
- **Import availability** — can an extension reliably `import { createAgentSession }` from its own host package? Need to verify the module resolution.
- **Tool cwd routing** — each session's tools need to point to different worktree directories. The SDK provides `createCodingTools(cwd)` factories, but the extension would need to manage this mapping carefully.

**Verdict: Risky.** The single-process constraint is the main issue. Pi's extension system was designed for a single session per process. While the SDK technically supports multiple sessions, extension compatibility under multi-session is untested.

### 4. Option C: CLI One-Shot Mode (`pi -p`)

**How it works:**
- The orchestrator runs `pi -p "Do the full story flow for STORY-x"` and waits for exit
- No streaming, no mid-flight control

**Pros:**
- Simplest possible approach
- True fire-and-forget

**Cons:**
- **No control** — cannot abort, steer, or monitor progress
- **Context limits** — a single Pi session trying to do pickup + implement + review + merge will likely exceed context window before finishing
- **No compaction control** — cannot trigger `/compact` mid-flow
- **Not viable for the pipeline feature** — we need orchestration, not batch jobs

**Verdict: Rejected.** Too limited for the requirements.

### 5. Option D: Hybrid — RPC Workers + Terminal Visibility

**How it works:**
- Same as Option A (RPC subprocesses), but the orchestrator also launches visible terminal windows
- On Windows: use `start cmd /k` or Windows Terminal's `wt` command to open new tabs/panes
- Each terminal shows the worker's streaming output (by piping events to a human-readable format)
- The orchestrator extension runs in the main Pi instance and manages the workers

**Terminal launching on Windows:**

```typescript
// Option 1: Windows Terminal (wt.exe) — new tab
spawn("wt", [
  "-w", "0",  // current window
  "nt",       // new tab
  "--title", `STORY-${storyName}`,
  "cmd", "/c",
  `pi --mode rpc --no-session --cwd "${worktreeDir}"`,
]);

// Option 2: New console window
spawn("cmd", ["/c", "start",
  `"STORY-${storyName}"`,
  "pi", "--mode", "rpc", "--no-session",
  "--cwd", worktreeDir,
]);
```

**But there's a problem:** The orchestrator needs to control the workers via RPC (stdin/stdout). If the worker is in a visible terminal, the user sees the terminal but the orchestrator can't pipe stdin/stdout because the terminal owns the stdio.

**Resolution — Two approaches:**

#### D1. Orchestrator owns the process, mirrors output to a visible terminal

The orchestrator spawns the RPC process with piped stdio (as in Option A). A separate "viewer" terminal window tails a log file that the orchestrator writes worker events to:

```typescript
// Worker outputs events → orchestrator writes to log file
// Separate terminal tails the log file for visibility

import { writeFileSync } from "fs";
const logPath = `C:/Github/${repo}-worktrees/STORY-${name}-pipeline.log`;

// On worker event:
appendFileSync(logPath, formatEvent(event) + "\n");

// Launch viewer terminal:
spawn("cmd", ["/c", "start",
  `"STORY-${storyName}"`,
  "cmd", "/c",
  `powershell -Command "Get-Content '${logPath}' -Wait"`,
]);
```

**Pros:** Full orchestrator control + user visibility
**Cons:** Log file is a buffer, not live stdio; slight latency; no interactivity in the viewer terminal

#### D2. Visible terminal is the actual Pi process; orchestrator communicates via filesystem

Each worker runs in its own terminal as an **interactive** Pi instance (not RPC). The orchestrator doesn't control workers via RPC — instead:

- **Orchestrator writes instructions to the vault** (e.g., `Pipeline/TASK-STORY-name.md` with instructions)
- **Workers poll or watch for their task file** and act on it
- **Workers update the vault board** to signal completion
- **Orchestrator watches the board** for state changes

This is a "mailbox" pattern — coordination is entirely through the shared Obsidian vault.

**Pros:**
- Each Pi instance is fully interactive — user can intervene in any worker
- No RPC complexity — just file-based coordination
- Workers can use all Pi features (TUI, extensions, skills) normally
- If a worker gets stuck, the user can interact with it directly

**Cons:**
- **No programmatic control** — the orchestrator can only influence workers through vault files
- **Race conditions** — multiple workers reading/writing the same vault files
- **Polling latency** — workers need to check for new tasks periodically
- **Harder to abort** — no direct signal to stop a worker
- **Context waste** — workers spend context watching for instructions instead of doing story work

**Verdict: Interesting but fragile.** The mailbox pattern adds complexity and race-condition risk. Better for human-driven orchestration than agent-driven.

---

### 6. Recommendation: Option A (RPC) with D1 (Log Mirroring)

**Primary approach:** The orchestrator extension spawns RPC-mode Pi subprocesses with piped stdio. Worker events are mirrored to visible terminal windows via log files. The orchestrator has full control over workers via RPC commands.

**Why this wins:**
1. **Full control** — orchestrator can send `prompt`, `steer`, `abort`, `compact` commands to any worker
2. **Visibility** — log-viewer terminals give the user real-time visibility into each worker's progress
3. **Process isolation** — worker crashes don't affect the orchestrator or other workers
4. **No extension conflicts** — each worker has its own extension state
5. **Works with existing cadence skills** — workers can run `/skill:cadence-pickup`, `/skill:cadence-review`, etc.
6. **The orchestrator itself is an extension** — runs inside the main Pi instance, has access to all tools

**Fallback for single-agent mode:** The orchestrator can also run the pipeline sequentially within the main Pi session (no subprocesses), calling skills directly via `pi.sendUserMessage()`. This is simpler but no parallelism.

### 7. Coordination Model

```
┌─────────────────────────────────────────────────┐
│  Main Pi Instance (Orchestrator)                 │
│  ┌─────────────────────────────────────────────┐ │
│  │ cadence-pipeline Extension                   │ │
│  │  - Reads vault Board.md to find stories     │ │
│  │  - Detects dependencies between stories     │ │
│  │  - Spawns/manages RPC workers               │ │
│  │  - Monitors worker health                   │ │
│  │  - Updates Pipeline state in vault          │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  Worker 1 (RPC)        Worker 2 (RPC)             │
│  ┌──────────────┐     ┌──────────────┐           │
│  │ STORY-auth   │     │ STORY-api    │           │
│  │ /pickup auth │     │ /pickup api  │           │
│  │ → implement  │     │ → implement  │           │
│  │ → /review    │     │ → /review    │           │
│  │ → /done      │     │ → /done      │           │
│  └──────────────┘     └──────────────┘           │
│         │                     │                   │
│         ▼                     ▼                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  Obsidian Vault (Shared State)               │ │
│  │  - Sprint/Board.md (story status)            │ │
│  │  - Pipeline/PIPELINE-<id>.md (pipeline state)│ │
│  │  - Git worktrees (code isolation)            │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**State coordination via vault:**
- `Pipeline/PIPELINE-<epic-or-id>.md` — tracks pipeline execution state:
  - List of stories and their pipeline status (queued, active, blocked, done, failed)
  - Dependency graph (which stories depend on which)
  - Worker assignments (which story each worker is on)
  - Pipeline-level metadata (started, completed, total points)
- `Sprint/Board.md` — the usual sprint board, updated by workers as they progress
- Workers read/write board state; the orchestrator reads it to make scheduling decisions

**Worker lifecycle (RPC commands):**
```
1. Orchestrator → Worker:  prompt("/skill:cadence-pickup <story>")
2. Worker events:           tool_execution_*, message_update (mirrored to log)
3. Worker completes pickup → starts implementing
4. Orchestrator monitors:   watches Board.md for status changes
5. Worker → auto:           runs through TDD cycle
6. Orchestrator → Worker:  prompt("/skill:cadence-review")
7. Review passes
8. Orchestrator → Worker:  prompt("/skill:cadence-done")
9. Worker creates PR, updates board to Done
10. Orchestrator → Worker: compact (or new_session for next story)
11. Orchestrator:           detects completion, assigns next story or terminates worker
```

### 8. Per-Worker Model Configuration

Pi supports model selection at **three levels**, all applicable to the pipeline:

| Level | Mechanism | When | Use case |
|-------|-----------|------|----------|
| **Spawn time** | `pi --model <pattern>` CLI flag | Worker creation | Different models per worker type |
| **Mid-session** | RPC `{ "type": "set_model", "provider": "...", "modelId": "..." }` | Any time during worker lifecycle | Switch model between pipeline phases |
| **Thinking level** | RPC `{ "type": "set_thinking_level", "level": "..." }` | Any time | Adjust reasoning depth per task |

**Practical pipeline configurations:**

| Role | Model suggestion | Thinking | Rationale |
|------|-----------------|----------|-----------|
| **Orchestrator** | Fast/cheap (e.g. `deepseek-v4-flash`) | `low` or `off` | Just dispatching commands, reading vault files — no code generation |
| **Implementation worker** | Capable (e.g. `deepseek-v4-pro`) | `medium` or `high` | Writing code, TDD, fixing review findings — needs quality |
| **Review worker** | Capable (same as impl or different) | `high` | Semantic evaluation, security review — needs deep reasoning |

**Example — spawning a worker with a specific model:**
```typescript
function spawnWorker(storyName: string, worktreeDir: string, model: string, thinking: string): Worker {
  const proc = spawn("pi", [
    "--mode", "rpc",
    "--no-session",
    "--model", model,          // e.g. "deepseek/deepseek-v4-pro"
    "--thinking", thinking,    // e.g. "high"
    "--cwd", worktreeDir,
  ], { stdio: ["pipe", "pipe", "pipe"] });
  // ...
}
```

**Example — switching model mid-session (e.g. before review):**
```typescript
// Switch worker to a stronger model for review phase
sendCommand(worker.process, {
  type: "set_model",
  provider: "deepseek",
  modelId: "deepseek-v4-pro",
});
sendCommand(worker.process, {
  type: "set_thinking_level",
  level: "high",
});
sendCommand(worker.process, {
  type: "prompt",
  message: "/skill:cadence-review",
});
```

**Pipeline-level model config (in AGENTS.md or cadence config):**

```markdown
## Cadence Config
pipeline.orchestrator_model: deepseek/deepseek-v4-flash
pipeline.orchestrator_thinking: off
pipeline.worker_model: deepseek/deepseek-v4-pro
pipeline.worker_thinking: medium
pipeline.review_model: deepseek/deepseek-v4-pro
pipeline.review_thinking: high
```

Or per-story override in the story file:
```markdown
**Pipeline-Model**: deepseek/deepseek-v4-flash:low
```

**Key insight:** The orchestrator can be extremely cheap since it doesn't write code — it only reads vault files, manages subprocesses, and sends RPC commands. Workers are the expensive part. This gives significant cost savings in multi-agent mode.

### 9. Dependency Detection

Dependencies between stories can be tracked via:
- **Epic files** (`Backlog/Epics/EPIC-<name>.md`) — if they list story dependencies
- **Story frontmatter** — add an optional `Depends-On: [STORY-x, STORY-y]` field
- **Branch dependencies** — if `STORY-b` needs code from `STORY-a`, it depends on `a` being merged to develop first
- **Implicit detection** — the orchestrator can scan story specs for references to other stories

**For v1, keep it simple:** Explicit `Depends-On` field in stories. The orchestrator builds a DAG from these declarations.

### 10. Compaction Strategy

**Single-agent mode:** After each story completes, the orchestrator triggers compaction:
```typescript
// Within the main Pi session (single-agent mode)
// The extension sends a compact command
pi.sendUserMessage("/compact Focus on pipeline orchestration. Summary of STORY-x completed.");
```

**Multi-agent mode:** Workers manage their own compaction via Pi's auto-compaction (triggers when context fills up). The orchestrator doesn't need to compact — it only tracks state and issues commands.

If a worker's context is full after completing a story and needs to start a new one:
```typescript
// Orchestrator → Worker RPC command:
sendCommand(worker.process, { type: "compact", customInstructions: "Story completed. Prepare for next story." });
// Then:
sendCommand(worker.process, { type: "prompt", message: `/skill:cadence-pickup <next-story>` });
```

Or start a fresh session per story:
```typescript
sendCommand(worker.process, { type: "new_session" });
sendCommand(worker.process, { type: "prompt", message: `/skill:cadence-pickup <next-story>` });
```

**Recommendation:** New session per story is cleaner — avoids context pollution between stories. The worker process stays alive, just gets a fresh session.

### 11. Error Recovery

| Scenario | Handling |
|----------|----------|
| Worker LLM call fails | RPC `auto_retry` handles transient errors automatically |
| Worker review fails 3 cycles | Orchestrator detects (board still "In Review"), steers worker to fix or escalates to user |
| Worker process crashes | Orchestrator detects (process exit), marks story as "blocked" on pipeline state, notifies user |
| Review finds CRITICAL security | Worker fixes and re-reviews per `cadence-review` skill; if unfixable, marks blocked, orchestrator notifies user |
| Merge conflict on develop | Orchestrator serializes: waits for all in-flight merges, then re-merges |
| All workers stuck | Orchestrator pauses pipeline, surfaces summary to user |

---

## Recommendation

**Primary: RPC subprocess workers (Option A + D1)**

- Extension spawns `pi --mode rpc --no-session --cwd <worktree>` per parallel story
- Communicates via JSONL RPC protocol
- Worker events mirrored to visible terminal windows via log files + `Get-Content -Wait`
- Coordination through Obsidian vault (`Pipeline/PIPELINE-<id>.md` + `Sprint/Board.md`)
- New session per story (not compaction) to keep worker context clean
- Single-agent mode: extension runs the pipeline sequentially within the main session

**Implementation path:**
1. Create `cadence-pipeline` extension (not just a skill — needs to manage subprocesses)
2. Pipeline state file in vault: `Pipeline/PIPELINE-<id>.md`
3. `/pipeline start <epic-or-stories>` command to kick off
4. `/pipeline status` to monitor
5. `/pipeline abort` to cancel all workers
6. Dependency graph built from `Depends-On` story metadata

### Confidence
**HIGH** — RPC mode is fully documented and designed for this exact use case. The extension system supports subprocess management. The main uncertainty is around the log-mirroring UX on Windows, which is a nice-to-have, not a blocker.

### Open Questions / Uncertainties
- Can the extension read `~/.pi/agent/auth.json` to verify API keys before spawning workers? (Likely yes, standard file read)
- Does Pi's RPC mode inherit the same extension/skill discovery from `--cwd`? (Docs say yes via DefaultResourceLoader)
- Windows Terminal `wt.exe` availability and tab naming behavior varies by Windows version — need graceful fallback
- Rate limiting: if using the same provider for orchestrator + N workers, will API rate limits be hit? (Depends on provider, may need to stagger worker starts)

---

## Competitive Analysis: pi-subagents (nicobailon/pi-subagents)

### What pi-subagents does

A mature Pi extension that implements **subagent orchestration** as a custom tool (`subagent`). It supports three modes:

| Mode | Description |
|------|------------|
| **Single** | Run one agent with a task |
| **Chain** | Run agents sequentially, passing `{previous}` output between steps |
| **Parallel** | Run agents concurrently with configurable concurrency limits |

### Architecture (what we can learn from)

#### 1. Subprocess spawning — `--mode json` (NOT RPC)

**Key finding:** pi-subagents does NOT use `--mode rpc`. It uses `--mode json -p "task"`:

```typescript
// execution.ts line ~200
const { args, env: sharedEnv, tempDir } = buildPiArgs({
  baseArgs: ["--mode", "json", "-p"],
  task,
  ...
});
const spawnSpec = getPiSpawnCommand(args);
const proc = spawn(spawnSpec.command, spawnSpec.args, {
  cwd: options.cwd ?? runtimeCwd,
  env: spawnEnv,
  stdio: ["ignore", "pipe", "pipe"],
});
```

**Why `--mode json` instead of `--mode rpc`:**
- One-shot execution: spawn → run task → collect output → exit. No need for bi-directional control.
- Simpler lifecycle: no need to manage stdin commands, session state, or connection teardown.
- JSON events on stdout are identical to RPC events — same parsing code works.
- The `-p` flag makes it non-interactive and auto-exiting.

**Implication for cadence-pipeline:** Our use case is different. We need multi-step orchestration (pickup → implement → review → done) within a single worker. That means either:
- (A) Use `--mode json -p` and give each step its own subprocess (like pi-subagents does for chains)
- (B) Use `--mode rpc` for a long-lived worker that receives multiple commands
- (C) Use `--mode json -p` with a single comprehensive prompt that drives the entire cadence flow

**Recommendation: Option C with a twist.** Spawn one Pi subprocess per story with a single comprehensive prompt. The prompt tells Pi to execute the full cadence flow. This is simpler than RPC and matches pi-subagents' proven pattern. For multi-story workers, we spawn a new subprocess per story (not a new RPC command on an existing connection).

#### 2. Model selection and fallback

pi-subagents has a sophisticated model system:

- **Per-agent model** in frontmatter: `model: openai-codex/gpt-5.5`
- **Per-step override** at invocation: `{ agent: "scout", model: "anthropic/claude-sonnet-4" }`
- **Fallback models**: `fallbackModels: ["openai/gpt-5-mini", "anthropic/claude-haiku-4-5"]` — tries next model on failure
- **Thinking level suffix**: `model: anthropic/claude-sonnet-4:high` — appended to model ID via `--model`
- **Provider preference**: resolves ambiguous model names to the current provider

**We should adopt:**
- Per-agent model config in cadence pipeline config
- Model fallback (try cheaper model if expensive one fails)
- Thinking level suffixes in config

#### 3. Worktree isolation

pi-subagents has a complete worktree isolation system for parallel execution:

- `worktree: true` flag on parallel tasks
- Creates a git worktree per parallel task from HEAD
- Symlinks `node_modules/` into each worktree
- Captures diffs after execution via `git add -A && git diff --cached`
- Cleans up worktrees in a `finally` block
- Optional `worktreeSetupHook` for custom per-worktree setup

**This is directly reusable for our pipeline.** Our cadence extension already has worktree management, but pi-subagents' approach of creating/cleaning up in a `finally` block is more robust. Key difference: cadence uses persistent worktrees (created at `/pickup`, removed at `/worktree remove`), while pi-subagents creates ephemeral ones per execution.

**For cadence-pipeline:** Use our existing persistent worktree model (stories last longer than a single command). But adopt the `finally` cleanup pattern and diff capture.

#### 4. Skill injection

pi-subagents injects skills into the subagent's system prompt:

```xml
<skill name="safe-bash">
[skill content from SKILL.md, frontmatter stripped]
</skill>
```

Agents declare skills in frontmatter: `skills: planning+review`.

**For cadence-pipeline:** Our workers need cadence skills (pickup, review, done, learn). We should inject them via `--skill` CLI flags or the agent frontmatter mechanism. Since cadence skills are already auto-discovered from `.pi/skills/`, workers spawned with the correct `--cwd` should get them automatically.

#### 5. Agent definition format

pi-subagents uses markdown files with YAML frontmatter:

```markdown
---
name: worker
description: General-purpose subagent with full capabilities
model: openai-codex/gpt-5.5
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
defaultReads: context.md, plan.md
defaultProgress: true
---

You are an implementation subagent...
```

**For cadence-pipeline:** We could define pipeline agent profiles this way:

```markdown
---
name: cadence-worker
description: Executes a single story through the full cadence lifecycle
model: deepseek/deepseek-v4-pro
thinking: medium
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: true
---

You are a cadence pipeline worker. Execute the following flow:
1. Run /skill:cadence-pickup for the assigned story
2. Implement following TDD (RED → GREEN → IMPROVE)
3. Run /skill:cadence-review
4. If review passes, run /skill:cadence-done
5. Run /skill:cadence-learn
...
```

#### 6. Inter-agent communication

pi-subagents uses `pi-intercom` for bidirectional communication between parent and child sessions:

- Children get an `intercom` tool to ask questions or report progress
- Parents can monitor and respond
- Requires the `pi-intercom` extension installed separately

**For cadence-pipeline:** We could use intercom for workers to report progress to the orchestrator, but our vault-based state coordination is simpler and more durable (survives restarts). Consider intercom as a future enhancement.

#### 7. Recursion guard

pi-subagents limits nesting depth via `PI_SUBAGENT_MAX_DEPTH` env var (default 2). Prevents runaway recursive spawning.

**For cadence-pipeline:** We should add a similar guard. Pipeline workers should NOT be able to spawn their own pipelines.

#### 8. Artifact and debug system

Comprehensive artifacts per run:
- `{runId}_{agent}_input.md` — task prompt
- `{runId}_{agent}_output.md` — full output
- `{runId}_{agent}.jsonl` — event stream
- `{runId}_{agent}_meta.json` — timing, usage, model, exit code

**For cadence-pipeline:** Adopt artifact logging. Store per-story execution logs in the vault under `Pipeline/` for debugging and audit trails.

#### 9. Chain directory for inter-step artifacts

Chain runs create a shared temp directory for inter-step files:
```
<tmpdir>/pi-subagents-<scope>/chain-runs/{runId}/
  context.md    — scout output
  plan.md        — planner output
  progress.md    — worker progress
```

**For cadence-pipeline:** The vault already serves this purpose. `Pipeline/PIPELINE-<id>.md` is our equivalent.

### Summary of Improvements for Our Design

| Area | Our original design | Improved design (after pi-subagents analysis) |
|------|-------------------|---------------------------------------------|
| **Spawn method** | RPC (`--mode rpc`) | JSON one-shot (`--mode json -p`) per story |
| **Worker lifecycle** | Long-lived RPC process, multiple commands | Ephemeral subprocess per story, single comprehensive prompt |
| **Model config** | Pipeline-level config in AGENTS.md | Pipeline config + per-agent profiles + fallback models |
| **Worktree** | Persistent (existing cadence approach) | Keep persistent, add `finally` cleanup and diff capture |
| **Skills** | Auto-discovery via `--cwd` | Auto-discovery + explicit `--skill` flags for pipeline-specific skills |
| **Recursion guard** | Not planned | `PI_SUBAGENT_MAX_DEPTH=1` on worker processes |
| **Artifacts** | Vault state only | Vault state + per-story execution logs with timing/usage |
| **Error recovery** | Board monitoring + steering | Same + model fallback on transient failures |
| **Compaction** | Pi's `/compact` between stories | Not needed — each story gets a fresh subprocess |

### Revised Recommendation

**Use `--mode json -p` (one-shot) instead of RPC.** Each story gets:
1. A fresh Pi subprocess with a comprehensive prompt that drives the entire cadence lifecycle
2. A worktree for code isolation
3. Model and thinking level from pipeline config
4. Cadence skills auto-discovered via `--cwd` pointing to the repo
5. Artifacts (input, output, JSONL events, metadata) written to vault `Pipeline/` directory

The orchestrator monitors JSON events on stdout to track progress. When the subprocess exits, the orchestrator checks the exit code, reads artifacts, and updates the pipeline state.

**For multi-story workers:** Don't reuse the process. Spawn a new subprocess per story. This gives each story a clean context window — no compaction needed.

### Sources Cited
1. Pi RPC docs: `docs/rpc.md` — full JSONL protocol specification
2. Pi SDK docs: `docs/sdk.md` — `createAgentSession()` API
3. Pi extensions docs: `docs/extensions.md` — extension lifecycle and capabilities
4. Pi compaction docs: `docs/compaction.md` — compaction mechanics
5. Pi CLI: `pi --help` — `--mode rpc`, `--no-session`, `--cwd` flags
6. Existing cadence extension: `packages/pi/.pi/extensions/cadence-flow.ts` — worktree management, command registration
7. Windows Terminal docs: `wt.exe` command-line arguments
8. pi-subagents repo: `https://github.com/nicobailon/pi-subagents` — competitive analysis source
