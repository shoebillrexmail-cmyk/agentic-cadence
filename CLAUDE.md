# agentic-cadence

## Monorepo Structure
- **shared/** — Single source of truth for conventions (both packages build from this)
- **packages/claude/** — Claude Code plugin (12 skills, 19 shared agents)
- **packages/pi/** — Pi package (12 skills + extension + consolidated shared-agents reference)
- **packages/domain/opnet/** — OPNet domain plugin (17 agents, 11 knowledge slices, 3 skills)
- Run `npm run build` to generate package-specific rules/prompts from shared core
- Run `npm run build:domain` to validate domain packages
- Run `npm test` to run the cadence-config parser tests

## Obsidian Project
- Vault project: agentic-cadence
- Sprint Board: C:\Obsidian_Vaults\agentic-cadence\Sprint\Board.md
- Product Backlog: C:\Obsidian_Vaults\agentic-cadence\Backlog\Product-Backlog.md
- Specs: C:\Obsidian_Vaults\agentic-cadence\Specs\
- Research: C:\Obsidian_Vaults\agentic-cadence\Research\
- Learning: C:\Obsidian_Vaults\agentic-cadence\Learning\
- Archive: C:\Obsidian_Vaults\agentic-cadence\Archive\
