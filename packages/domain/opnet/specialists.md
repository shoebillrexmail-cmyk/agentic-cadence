---
domain: opnet
description: OPNet Bitcoin L1 smart contract platform — contracts, frontends, backends, deployment, and security
---

## Detection

How to determine if a project uses OPNet:
- `package.json` contains `@btc-vision/` dependencies
- `asconfig.json` exists (AssemblyScript compiler config)
- Source files import from `@btc-vision/btc-runtime`, `opnet`, or `@btc-vision/transaction`
- CLAUDE.md references OPNet or frogop vault project

## Agents

### Story Creation
Consult these agents for approach feedback when creating stories:

| Agent | Purpose |
|-------|---------|
| `opnet-contract-dev` | Contract architecture, storage pointer design, SafeMath patterns, event design |
| `opnet-frontend-dev` | Wallet integration, WalletConnect patterns, transaction simulation flow |
| `opnet-backend-dev` | RPC provider patterns, indexer design, rate limiting, UTXO handling |

### Development
Invoke these agents during active development:

| Trigger | Agent | Purpose |
|---------|-------|---------|
| Writing `.ts` files in contract directories or importing `@btc-vision/btc-runtime` | `opnet-contract-dev` | Validate patterns, storage layout, SafeMath usage, event emission |
| Writing `.tsx`/`.ts` files importing from `opnet` or using wallet/signer patterns | `opnet-frontend-dev` | Validate signer: null, simulation before send, networks.opnetTestnet |
| Writing `.ts` files importing from `@btc-vision/transaction` or `hyper-express` | `opnet-backend-dev` | Validate RPC patterns, error handling, UTXO chaining |
| Making architectural decisions for contract state | `spec-writer` | Formal TLA+ verification of state machine design |

### Review
Run these agents during `/cadence:review`:

| Condition | Agent | Purpose |
|-----------|-------|---------|
| Contract files changed | `opnet-auditor` | 27 real-bug pattern security checklist |
| Contract files changed | `contract-optimizer` | Gas efficiency, storage layout optimization |
| Frontend files changed | `frontend-analyzer` | 40+ OPNet frontend anti-pattern checks |
| Backend files changed | `backend-analyzer` | Reliability, caching, error recovery, RPC patterns |
| Multiple layers changed | `cross-layer-validator` | ABI/address/network consistency across layers |
| Any OPNet files changed | `dependency-auditor` | Package versions, @rc tags, conflicts, missing overrides |

## Domain Rules

Constraints to follow during OPNet development:

### Contract Rules
- No `Buffer` — use `Uint8Array` only
- `SafeMath` required for ALL arithmetic operations
- No logic in constructor — use `onDeployment()` for initialization
- ECDSA is DEPRECATED — use ML-DSA (`Blockchain.verifySignature` with `SignaturesMethods.MLDSA`)
- `Address.fromString()` requires TWO params: `(hashedMLDSAKey, tweakedPubKey)`
- Storage pointer order determines on-chain layout — never reorder existing pointers
- Use `@btc-vision/btc-runtime` (never `bitcoinjs-lib`)

### Frontend Rules
- `signer: null`, `mldsaSigner: null` in `sendTransaction()` — wallet handles signing
- ALWAYS simulate before send: `contract.method().simulate()` then `sendTransaction()`
- Use `networks.opnetTestnet` for OPNet testnet (NOT `networks.testnet` — that's Testnet4)
- Use `getContract` from `opnet` npm package for contract interactions
- NEVER construct raw PSBTs — no `new Psbt()`, no `Psbt.fromBase64()`
- Extra inputs/outputs: use `setTransactionDetails()` BEFORE simulate

### Backend Rules
- `signer: wallet.keypair`, `mldsaSigner: wallet.mldsaKeypair` in `sendTransaction()` — backend MUST specify both
- Use `@btc-vision/transaction` ONLY for `TransactionFactory` (deployments, BTC transfers)
- NEVER use `@btc-vision/transaction` for contract calls — use `opnet` package instead

## Test Types

Additional test categories for OPNet projects:

| Test Type | When Required | Description |
|-----------|--------------|-------------|
| Contract Tests | When contract code is changed | Test contract methods against ABI — valid inputs, invalid inputs (revert), state changes, access control, boundary values (0, MAX_U256) |
| On-chain E2E Tests | When contract is deployed to testnet | Real transactions against deployed contract using test wallets — every public method must be tested |
| Adversarial Tests | Before mainnet deployment | Boundary values, revert exploitation, access control bypass, race conditions |

## MCP Tools

If `opnet-bob` MCP server is connected, these tools enrich the workflow:

| Tool | When to Use | Purpose |
|------|------------|---------|
| `opnet_audit` | During review, after local agents | Second opinion security scan — cross-reference with opnet-auditor findings |
| `opnet_dev` | During story creation | Contract scaffolding, boilerplate generation, OPNet-specific guidance |
| `opnet_incident_query` | During story creation and pickup | Check for known pitfalls related to the feature type |
| `opnet_cli` | During deployment | On-chain operations, query state, check deployed contracts |
| `btc_monitor` | During deployment planning | Block confirmations, transaction finality, gas parameters |
| `opnet_skill_doc` | Anytime | Query OPNet documentation for up-to-date API references |
