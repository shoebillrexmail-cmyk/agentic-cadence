# Specialist Convention

## How Domain Plugins Integrate with Agentic Cadence

Agentic Cadence is a general-purpose agent workflow framework. It does NOT hardcode domain-specific knowledge (OPNet, Rust, Elixir, etc.). Instead, domain plugins register their specialists through a convention that Cadence discovers at runtime.

## The Convention

Domain plugins provide a `specialists.md` file in their plugin root. This file follows a structured format that Cadence reads during story creation, story pickup, and review.

### Discovery

Cadence finds specialist configurations by:

1. **Story's Specialist Context** — the `## Specialist Context` section in the story file records which specialists were consulted at creation time. At pickup, this is the primary source.
2. **Domain plugin files** — domain plugins in `packages/domain/<domain>/` provide `specialists.md` files. Claude can find these via the monorepo structure. Pi loads them from the domain package path.
3. **Domain routing rules** — `packages/domain/<domain>/agent-routing.md` files contain trigger-based agent invocation rules.
4. **Project CLAUDE.md** — a `## Specialists` section in the project's CLAUDE.md can point to specific specialist configs.
5. **Loaded rules** — domain plugins may install rules to `~/.claude/rules/` that contain specialist routing logic.

### specialists.md Format

Domain plugins should provide a `specialists.md` file with this structure:

```markdown
---
domain: <domain-name>
description: <one-line description>
---

## Detection

How to determine if a project uses this domain:
- <detection rule 1: e.g., "package.json contains X">
- <detection rule 2: e.g., "file Y exists">
- <detection rule 3: e.g., "source files import from Z">

## Agents

### Story Creation
Agents to consult for approach feedback when creating stories:
| Agent | Purpose |
|-------|---------|
| <agent-name> | <what it advises on> |

### Development
Agents to invoke during active development:
| Trigger | Agent | Purpose |
|---------|-------|---------|
| <when to invoke> | <agent-name> | <what it does> |

### Review
Agents to run during /cadence:review:
| Condition | Agent | Purpose |
|-----------|-------|---------|
| <when to run> | <agent-name> | <what it checks> |

## Domain Rules
Constraints to follow during development in this domain:
- <rule 1>
- <rule 2>

## Test Types
Additional test categories beyond standard unit/integration/E2E:
| Test Type | When Required | Description |
|-----------|--------------|-------------|
| <type> | <condition> | <what it tests> |

## MCP Tools
Optional MCP tools that enrich the workflow (if connected):
| Tool | When to Use | Purpose |
|------|------------|---------|
| <tool-name> | <condition> | <what it provides> |
```

### How Cadence Uses This

| Cadence phase | What it reads from specialists.md |
|---------------|----------------------------------|
| `/cadence:story` (creation) | Detection → determine domain. Story Creation agents → consult. Domain Rules + Test Types → populate story. |
| `/cadence:pickup` (development) | Development agents → load trigger table. Domain Rules → enforce during coding. |
| `/cadence:review` (review) | Review agents → add to parallel dispatch. Domain Rules → inform R2 patches. |

### Multiple Domain Plugins

A project can match multiple domains (e.g., OPNet + React frontend). Cadence merges specialist configs:
- All matching detection rules trigger their respective domain
- Agent lists are merged (deduplicated)
- Domain rules from all matching domains apply
- Test types from all matching domains are included

### No Domain Plugin Installed

If no domain plugin is installed, Cadence still works with its built-in general-purpose agents:
- `code-reviewer` — general code quality
- `security-reviewer` — OWASP top 10, secrets, auth
- `tdd-guide` — test-driven development
- `architect` — design decisions
- `planner` — implementation planning

Language-specific reviewers (`go-reviewer`, `python-reviewer`) are built into Claude Code and always available — they don't require a domain plugin.
