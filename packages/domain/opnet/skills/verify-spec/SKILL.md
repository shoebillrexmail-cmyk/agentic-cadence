---
description: Generate a TLA+ formal specification for a contract and verify it with TLC
---

Formally verify a smart contract design before writing code. Argument: "$ARGUMENTS" describes the contract or points to requirements.

1. **Setup TLC** (if not already installed):
   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/setup-tla.sh
   ```

2. **Generate the spec**: Launch the `spec-writer` agent with the contract requirements. It will:
   - Translate requirements into a TLA+ specification (`.tla` + `.cfg`)
   - Define state variables, actions, and invariants
   - Model OPNet-specific concerns (partial reverts, CSV timelocks, reservation systems)

3. **Run TLC verification**:
   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/verify-spec.sh artifacts/spec/<ContractName>.tla
   ```

4. **Handle results**:
   - **Pass**: All invariants hold. Safe to proceed to implementation.
   - **Fail**: TLC found a counterexample. Re-launch `spec-writer` with the violation to fix the design.
   - Iterate until all invariants pass.

5. **Report**: Summarize what was verified — invariants checked, states explored, any violations found and fixed.
