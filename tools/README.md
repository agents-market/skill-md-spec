# OpenAPI to SKILL.md Generator

Reference tool that converts any OpenAPI 3.x spec into:

- **N child SKILLs** - one per endpoint, each with full frontmatter
- **1 parent SKILL** - router with hardcoded child skill names + keyword-based routing
- **manifest.json** - index of all generated files

## Why this tool?

Anyone with an OpenAPI spec can instantly onboard their API to any SKILL.md-compatible marketplace. No code required.

## Usage

```bash
node tools/generate-skills-from-openapi.mjs <openapi-source> [options]

# Stripe (594 endpoints)
node tools/generate-skills-from-openapi.mjs \
  https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.yaml \
  --api-name stripe --author-id 0xYourAddress

# OpenAI (200 endpoints)
node tools/generate-skills-from-openapi.mjs \
  https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml \
  --api-name openai --author-id 0xYourAddress

# Local file
node tools/generate-skills-from-openapi.mjs ./my-api-spec.json \
  --api-name myapi --author-id 0xYourAddress
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--api-name <name>` | API name (used in skill names, tags) | `api` |
| `--output <dir>` | Output directory | `./generated/<api-name>/` |
| `--price <micro-usdc>` | Default price per skill | `1000` ($0.001) |
| `--author-id <0x...>` | Your agent ID for all generated SKILLs | placeholder |
| `--author-name <name>` | Author display name | same as api-name |
| `--max-endpoints <n>` | Limit endpoints (for testing) | unlimited |
| `--include-tag <tag>` | Only endpoints with this tag | all |
| `--exclude-path <regex>` | Exclude paths matching regex | none |

## Output format

Each generated SKILL.md follows the SKILL.md spec.

Child SKILL example:

```yaml
---
name: stripe-createpaymentintent
description: Creates a Stripe payment intent
version: 1.0.0
author_name: Stripe
author_id: 0xYourAddress
author_contact: support@stripe.example
price_usdc: 1000
is_free: false
tags:
  - stripe
  - payment
openapi_compatible: true
mcp_compatible: false
runtime: any
---
```

Parent SKILL includes routing logic:

```yaml
routes:
  - id: route_1
    skill_name: stripe-getaccount
    keywords: ["stripe", "account", "get"]
    endpoint: GET /v1/account
  - id: route_2
    skill_name: stripe-postpaymentintents
    keywords: ["stripe", "payment", "intents"]
    endpoint: POST /v1/payment_intents
```

## Verified APIs

- **Stripe** - 594 endpoints to 595 SKILLs in 0.356s
- **OpenAI** - ~200 endpoints
- **GitHub** - ~500 endpoints

## Roadmap

- **Phase 2** - Auto-publish to marketplace via `POST /v1/skills`
- **Phase 3** - Smart LLM-assisted routing in parent skill
- **Phase 4** - Multi-spec composition (parent of parents)

## License

CC0 - public domain. Use freely.
