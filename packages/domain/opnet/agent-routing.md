# OPNet Agent Routing

> Claude: Read this file at session start. Use it to automatically invoke the right specialist agent based on what you're doing. You do NOT need the user to ask — if the trigger condition is met, use the agent proactively.

## How to Detect an OPNet Project

This project is OPNet if ANY of these are true:
- CLAUDE.md contains `## Obsidian Project` pointing to frogop or another OPNet vault project
- `package.json` contains `@btc-vision/` dependencies
- Source files import from `@btc-vision/btc-runtime`, `opnet`, or `@btc-vision/transaction`
- Source files contain `AssemblyScript` contracts extending `OP20` or `OP_NET`
- `asconfig.json` exists (AssemblyScript compiler config)

If this is NOT an OPNet project, these rules do not apply.

## OPNet MCP Server (`opnet-bob`)

The `opnet-bob` MCP server (`https://ai.opnet.org/mcp`) provides live OPNet tools. If available, agents should prefer MCP tools over local-only analysis for richer results.

### MCP Tool → Agent Mapping

| MCP Tool | Use with agent | How it helps |
|----------|---------------|-------------|
| `opnet_audit` | `opnet-auditor`, `frontend-analyzer` | Live security analysis from OPNet's own auditor — use alongside the local 27-pattern scan for a second opinion |
| `opnet_dev` | `opnet-contract-dev` | Contract scaffolding, boilerplate generation — use when creating new contracts from scratch |
| `opnet_cli` | `opnet-deployer`, `migration-planner`, `e2e-tester` | On-chain operations — deploy, query state, check deployed contracts |
| `bitcoin_bips` | `spec-writer`, `spec-auditor` | BIP references for formal verification of Bitcoin-level invariants (CSV, timelocks, PSBT) |
| `btc_monitor` | `migration-planner`, `opnet-deployer` | Check deployment status, block confirmations, transaction finality |
| `crypto_charts` | Research spikes (`/cadence:spike`) | Market data for pricing models, volatility research |
| `skill_doc` / `skill_catalog` | All agents | Query OPNet documentation for up-to-date API references |
| `web_search` | All agents | Search for OPNet issues, community solutions, package changelogs |

### When to Use MCP vs Local Analysis

| Scenario | Use MCP | Use local agent | Use both |
|----------|---------|----------------|----------|
| Security audit | `opnet_audit` for live scan | `opnet-auditor` for 27-pattern checklist | **Both** — cross-reference findings |
| New contract | `opnet_dev` for scaffolding | `opnet-contract-dev` for implementation | MCP scaffolds, agent builds |
| Deployment | `opnet_cli` for on-chain tx | `opnet-deployer` for process/safety | MCP executes, agent validates |
| Migration | `btc_monitor` for chain state | `migration-planner` for plan | MCP reads live state, agent plans |
| Research | `web_search`, `bitcoin_bips` | `spec-writer` / `spec-auditor` | MCP gathers data, agent models |

### Agent Integration Rules

When an agent is invoked in an OPNet project:
1. **Check if MCP tools are available** — if `opnet-bob` MCP is connected, prefer MCP tools for live data
2. **Local analysis first, MCP second** — run the local checklist/scan, then use MCP for validation or enrichment
3. **Cross-reference findings** — if both `opnet_audit` (MCP) and `opnet-auditor` (local agent) flag the same issue, it's high confidence. If only one flags it, investigate further.
4. **MCP for live state** — agents like `migration-planner` and `e2e-tester` should use MCP tools to read actual on-chain state when available, rather than just analyzing source code
5. **Fall back gracefully** — if MCP is not connected, all agents work fully from local analysis. MCP enriches but is never required.


## Automatic Agent Triggers

### When WRITING contract code
**Trigger**: You are creating or modifying `.ts` files in a contract directory (contains `asconfig.json` or imports from `@btc-vision/btc-runtime`)
**Before coding**: Read `knowledge/opnet-bible.md` sections [CONTRACT] and `knowledge/slices/contract-dev.md`
**After coding**: Invoke `contract-optimizer` agent on the changed files
**Agent**: Use `opnet-contract-dev` agent's rules even if not formally invoked — never use `Buffer`, always use `SafeMath`, never put logic in constructor, etc.

### When WRITING frontend code
**Trigger**: You are creating or modifying `.tsx`/`.ts` files that import from `opnet` or use `useWalletConnect`
**Before coding**: Read `knowledge/slices/frontend-dev.md`
**After coding**: Invoke `frontend-analyzer` agent on the changed files
**Always**: `signer: null`, `mldsaSigner: null`, simulate before send, `networks.opnetTestnet`

### When WRITING backend code
**Trigger**: You are creating or modifying backend `.ts` files that import from `opnet` or `@btc-vision/transaction`
**Before coding**: Read `knowledge/slices/backend-dev.md`
**After coding**: Invoke `backend-analyzer` agent on the changed files

### When REVIEWING or AUDITING code
**Trigger**: User asks to review, audit, check, or verify contract/frontend/backend code
**Action**: Invoke the appropriate agent(s) in parallel:

| What's being reviewed | Agents to invoke |
|-----------------------|-----------------|
| Contract security | `opnet-auditor` (27 patterns) + `opnet-adversarial-auditor` |
| Contract performance | `contract-optimizer` |
| Contract design | `spec-auditor` (reverse TLA+ verification) |
| Frontend code | `frontend-analyzer` (40+ checks) |
| Backend code | `backend-analyzer` |
| All layers together | `cross-layer-validator` + `dependency-auditor` |
| Pre-deployment | All of the above in parallel |

### When DESIGNING a new contract or feature
**Trigger**: User describes a new contract, a feature with state transitions, or business logic that handles value (tokens, BTC, reservations)
**Action**:
1. First: `spec-writer` — generate TLA+ spec and verify invariants before writing any code
2. Then: implement using `opnet-contract-dev` rules
3. After: `opnet-auditor` + `spec-auditor` to verify

### When UPGRADING or MIGRATING a contract
**Trigger**: User mentions upgrading, migrating, changing storage, adding fields to a deployed contract, or moving to mainnet
**Action**: Invoke `migration-planner` BEFORE making any changes
**Critical**: Storage pointer order changes = data corruption. Always plan first.

### When BUILD FAILS or dependencies break
**Trigger**: npm install fails, build errors mentioning `@btc-vision`, type errors from OPNet packages
**Action**: Invoke `dependency-auditor` to check for version conflicts, missing overrides, conflicting packages

### When DEBUGGING transaction failures
**Trigger**: User reports failed transactions, "simulation failed", gas errors, or unexpected reverts
**Action**:
1. Read `knowledge/opnet-troubleshooting.md`
2. Check frontend for missing simulation (`frontend-analyzer`)
3. Check contract for revert conditions (`opnet-auditor`)
4. Check cross-layer consistency (`cross-layer-validator`)

### When CREATING a PR or completing a story
**Trigger**: About to push code or create a PR for an OPNet project
**Action**: Run these checks (parallel where possible):
1. `dependency-auditor` — packages are correct
2. `cross-layer-validator` — ABI/network consistency
3. `frontend-analyzer` or `backend-analyzer` — anti-pattern scan on changed files
4. `opnet-auditor` — if contract files were changed

Report findings to the user before pushing. CRITICAL findings block the PR.

## Agent Invocation Priority

When multiple agents could apply, use this priority:

1. **Security agents first** — auditor, adversarial-auditor (blocks if CRITICAL)
2. **Design verification** — spec-auditor, spec-writer (blocks if invariant violation)
3. **Integration** — cross-layer-validator, dependency-auditor (blocks if MISMATCH)
4. **Optimization** — contract-optimizer, frontend-analyzer, backend-analyzer (advisory)
5. **Planning** — migration-planner (advisory but CRITICAL for upgrades)

## Parallel Execution

Always run independent agents in parallel for speed:

```
# Pre-deployment gate (run all in parallel):
├── opnet-auditor (contract security)
├── frontend-analyzer (frontend anti-patterns)
├── backend-analyzer (backend reliability)
├── cross-layer-validator (integration)
├── dependency-auditor (packages)
└── spec-auditor (design verification)
```

## What NOT to Do

- Do NOT invoke agents on non-OPNet code (regular TypeScript, Python, etc.)
- Do NOT run the full suite for a one-line change — scope to affected layers
- Do NOT block on LOW/MEDIUM findings — report them but continue
- Do NOT invoke migration-planner for new deployments (only upgrades)
- Do NOT re-run agents on code that hasn't changed since the last run
