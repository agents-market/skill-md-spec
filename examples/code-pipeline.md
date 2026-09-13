---
name: code-refactor
version: 1.0.0
author: agents-market
license: CC0-1.0
price_usdc: 50000   # $0.05 per refactor
is_paid: true
---

# Bob's Code Refactor Pipeline

> Reference implementation for PIPELINE.md v0.1.

## What it does

Takes a code file + task description, returns refactored code with tests and documentation.

```
Input:  { code, language, task }
Stages: analyze → refactor → test → document
Output: { refactored_code, tests, readme }
```

## Spec

```yaml
name: code-refactor
version: 1.0.0
description: Refactor code with tests + documentation. 4-stage pipeline using MiniMax models.
author: agents-market
license: CC0-1.0
price_usdc: 50000

inputs:
  - name: code
    type: string
    required: true
    description: Source code to refactor
  - name: language
    type: string
    required: true
    enum: [python, javascript, typescript, rust, go]
    description: Programming language
  - name: task
    type: string
    required: true
    description: What to refactor (e.g. "convert callbacks to async/await")

output:
  format: json
  schema:
    refactored_code: string   # full refactored source
    tests: string             # generated test file
    readme: string            # usage docs
    summary: string           # 1-paragraph explanation of changes

quality:
  min_rating: 3.5             # refund if rated below 3.5/5
  refund_window: 24           # hours after delivery

limits:
  max_tokens: 30000
  max_cost_usdc: 100          # $0.10 hard cap
  timeout_seconds: 600        # 10 min

execution:
  model: variant_a_bob_server

stages:
  - id: analyze
    model: MiniMax-M3
    system: You are a senior code reviewer. Identify improvement opportunities.
    prompt: |
      Language: {{language}}
      Task: {{task}}

      Code:
      ```
      {{code}}
      ```

      List 3-5 specific improvement opportunities (be concrete: function names, line numbers).
      Format: bullet list, one opportunity per line.

  - id: refactor
    model: MiniMax-M3
    depends_on: [analyze]
    system: You are a senior engineer. Return ONLY the refactored code, no explanation.
    prompt: |
      Original code ({{language}}):
      ```
      {{code}}
      ```

      Improvements to apply:
      {{analyze}}

      Task: {{task}}

      Return ONLY the full refactored source code. No markdown, no commentary, no code fences.

  - id: test
    model: MiniMax-M2.7
    depends_on: [refactor]
    system: You are a test engineer. Write comprehensive unit tests.
    prompt: |
      Write unit tests for this refactored {{language}} code:
      ```
      {{refactor}}
      ```

      Cover edge cases. Use {{language}} standard test framework.

  - id: document
    model: MiniMax-M2.7
    depends_on: [refactor]
    system: You are a technical writer. Write clear README docs.
    prompt: |
      Write a README.md for this refactored {{language}} code:
      ```
      {{refactor}}
      ```

      Include: overview, usage example, API reference.

  - id: summary
    model: MiniMax-M2.7
    depends_on: [analyze, refactor]
    prompt: |
      Write 1 paragraph summarizing what changed.
      Original analysis: {{analyze}}
      Refactored code: {{refactor}}
```

## Execution

```typescript
import { MiniMaxProvider, runPipeline } from '@agentsmarket/pipeline-runtime';

const provider = new MiniMaxProvider();
const result = await runPipeline(spec, { code, language, task }, { provider });

console.log(result.refactor);   // refactored code
console.log(result.tests);      // test file
console.log(result.readme);     // README
console.log(result.summary);    // 1-paragraph summary
```

## Why this works

| Stage | Model | Reason |
|-------|-------|--------|
| analyze | MiniMax-M3 | Complex: needs deep code understanding |
| refactor | MiniMax-M3 | Complex: needs to preserve semantics while restructuring |
| test | MiniMax-M2.7 | Simple: pattern-matching against test templates |
| document | MiniMax-M2.7 | Simple: structured prose generation |
| summary | MiniMax-M2.7 | Simple: summarization |

Total cost: ~$0.03 (mostly from M3 stages). Price $0.05 = 60% margin.

## Use cases

- "Refactor my Python script to use async/await"
- "Convert my JavaScript callbacks to promises"
- "Add error handling to my Rust CLI tool"
- "Modernize my TypeScript code to ES2022"
