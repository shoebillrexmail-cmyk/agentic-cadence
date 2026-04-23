# agentic-cadence

## Monorepo Structure
- **shared/** — Single source of truth for conventions (both packages build from this)
- **packages/claude/** — Claude Code plugin (12 skills)
- **packages/pi/** — Pi package (11 skills + extension)
- **packages/domain/opnet/** — OPNet domain plugin (17 agents, knowledge, skills)
- Run `npm run build` to generate package-specific rules/prompts from shared core
- Run `npm run build:domain` to validate domain packages

## Obsidian Project
- Vault project: claude-agile-flow
- Sprint Board: C:\Obsidian_Vaults\claude-agile-flow\Sprint\Board.md
- Product Backlog: C:\Obsidian_Vaults\claude-agile-flow\Backlog\Product-Backlog.md
- Specs: C:\Obsidian_Vaults\claude-agile-flow\Specs\
- Research: C:\Obsidian_Vaults\claude-agile-flow\Research\
