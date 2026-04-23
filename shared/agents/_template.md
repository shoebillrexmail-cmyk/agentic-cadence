<!--
Source-of-truth prompt bodies for shared cadence agents.

These files contain the system-prompt BODY only — no YAML frontmatter.
The build step wraps each one with runtime-specific frontmatter:
  - Claude: `shared/build.mjs` prepends `name:`, `description:`, `model:`, `tools:`
           and emits to `packages/claude/agents/<filename>.md`
  - Pi:    skills inline the body at build time (Pi has no subagent runtime)

CONVENTIONS every shared agent file must follow:

1. FIRST LINE of the body is a single-sentence description (no heading, no
   blank line before it). The build step extracts this verbatim into the
   `description:` frontmatter field shown to the caller at tool-selection time.
   Keep it actionable and include the main trigger condition.

2. Immediately after the description, include a `<example>` block that shows
   a typical invocation. The Claude subagent selector uses these to pick the
   right agent. One example is enough; two if the agent has distinct modes.

3. Below the examples, use these sections (in order):
   - ## Purpose       — one paragraph on what this agent exists to do
   - ## When invoked  — trigger conditions / caller skills
   - ## Inputs        — what the caller MUST pass in the prompt
   - ## Outputs       — exact shape of what the agent returns
   - ## Rules         — hard constraints; what NEVER to do
   - ## Process       — step-by-step behavior (numbered)

4. Keep each file under ~120 lines. Shared agents are methodology, not
   reference material — domain knowledge lives in `packages/domain/*/knowledge/`.

5. NEVER reference Claude- or Pi-specific tools or paths. These bodies must
   be runtime-agnostic. If behavior differs per runtime, say "the calling
   skill" not "the Task tool" or "the Skill tool".

6. Shared agents are ALWAYS-ON — do not add detection rules or `if domain ==`
   branches. If an agent is domain-specific, it belongs in `packages/domain/`.
-->
