---
license: CC0-1.0
---

# PIPELINE.md — Multi-Skill Workflow Spec (v0.1)

> Companion to [SKILL.md](./SPEC.md). SKILL.md = single capability. PIPELINE.md = orchestration of multiple capabilities into a workflow.

---

## Concept

A PIPELINE is a **declarative workflow** that chains multiple LLM stages into a single paid service.

```yaml
# Example: Bob's Code Refactor — $0.50 per refactor
name: code-refactor
stages:
  - id: analyze     # understand the code
  - id: refactor    # rewrite it
  - id: test        # write tests
  - id: document    # write docs
```

Pipeline specs are versioned, signed, and published like SKILL.md files. Buyers invoke the pipeline (single payment), the executor runs all stages, returns the output.

---

## Schema (v0.1)

```yaml
# Required
name: <kebab-case>             # unique pipeline name (e.g. "code-refactor")
version: <semver>              # e.g. "1.0.0"
stages:                        # ordered list of stages
  - id: <kebab-case>           # unique stage ID
    model: <model-name>        # e.g. "MiniMax-M3", "claude-3.5-sonnet"
    system: <prompt>           # optional system prompt
    prompt: <prompt>           # required: stage instructions
    depends_on: [<stage-ids>]  # optional: explicit dependencies (default: previous stage)

# Optional
description: <text>            # human-readable description
price_usdc: <micro-USDC>       # e.g. 50000 = $0.05 (REQUIRED for paid pipelines)
inputs:                        # typed input parameters
  - name: code
    type: string
    required: true
output:                        # expected output format
  format: text | json | zip
  files: [<output-files>]
quality:                       # quality guarantees (Phase 2)
  min_rating: <0-5>
  refund_window: <hours>
limits:                        # execution constraints (enforced via escrow)
  max_tokens: <int>
  max_cost_usdc: <int>
  timeout_seconds: <int>
execution:                     # how stages run
  model: variant_a_bob_server  # MVP: Bob runs on his server
  # variant_b_tee            # Phase 2: Trusted Execution Env
  # variant_c_client         # Phase 3: client-side execution
```

---

## Execution Model

### Variant A (MVP) — Bob's server
- Bob receives `{ inputs, payment_proof }`
- Bob runs stages sequentially on his hardware
- Returns `{ outputs: { stage_id: result } }` + signed URL for any files
- Trust via reputation + refund window
- Implementation: [`packages/pipeline-runtime`](https://github.com/agents-market/main/tree/main/packages/pipeline-runtime)

### Variant B (Phase 2) — TEE
- Same as A but runs inside Trusted Execution Environment (Intel SGX / AMD SEV)
- Cryptographic attestation that code wasn't modified
- Required for enterprise compliance

### Variant C (Phase 3) — Client-side
- Pipeline specs are downloaded and executed by the calling agent
- No server trust required
- Limited to small models (MiniMax-M2.7-highspeed tier)

---

## Reference Implementations

### Code Pipeline (Bob's Code Refactor)

See [`examples/code-pipeline.md`](./examples/code-pipeline.md) for the full spec.

Summary:
- **Input:** `{ code: string, language: string, task: string }`
- **Stages:** analyze → refactor → test → document
- **Models:** MiniMax-M3 (analyze, refactor) + MiniMax-M2.7 (test, document)
- **Output:** zip with refactored_code.txt, tests.txt, README.md
- **Price:** 50,000 micro-USDC ($0.05)
- **Use case:** "Refactor my Python script to use async/await"

### Music Pipeline (planned)

- **Input:** `{ lyrics: string, style: string, duration_seconds: int }`
- **Stages:** vocal_tune → instrumental → mix → master
- **Output:** mp3 file
- **Price:** 200,000 micro-USDC ($0.20)
- **Use case:** "Generate a lo-fi hip-hop beat from my poem"

### Design Pipeline (planned)

- **Input:** `{ brief: string, style: string, dimensions: string }`
- **Stages:** concept → wireframe → hi-fi → export
- **Output:** zip with PNG, Figma JSON, design tokens
- **Price:** 300,000 micro-USDC ($0.30)
- **Use case:** "Generate a landing page mockup for a SaaS product"

---

## Why Pipelines Matter

| Single SKILL | PIPELINE |
|--------------|----------|
| $0.001–$0.01 per call | $0.05–$1.00 per call |
| Atomic operation | Multi-stage composition |
| Trust = skill reputation | Trust = pipeline executor + reputation |
| Low value per transaction | High value per transaction |

**Pipeline-as-Product** — the missing primitive in agent marketplaces.

---

## Conformance

PIPELINE.md v0.1 is a **subset** of what the [`@agentsmarket/pipeline-runtime`](https://github.com/agents-market/main) supports:

- ✅ Linear stage chains (declared order)
- ✅ Stage dependencies (`depends_on`)
- ✅ Model routing by name
- ✅ Provider abstraction (MiniMax, Claude, OpenAI)
- 🔜 Parallel branches (DAG execution)
- 🔜 Loops / conditionals
- 🔜 Human-in-the-loop checkpoints
- 🔜 Streaming outputs

Implementations must:
1. Validate spec against JSON Schema
2. Verify model names against provider registry
3. Enforce `limits` (timeout, tokens, cost)
4. Honor `quality.min_rating` (refund if not met)
5. Emit metrics: stage_duration, token_usage, cost_actual

---

## See Also

- [SKILL.md spec](./SPEC.md) — single-capability skills
- [OpenAPI → PIPELINE generator](https://github.com/agents-market/main/tree/main/scripts) — derive pipelines from REST APIs
- [Reference implementation](https://github.com/agents-market/main/tree/main/packages/pipeline-runtime)
