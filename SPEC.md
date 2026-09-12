# SKILL.md Specification v1.0

> A vendor-neutral format for describing AI-agent-callable skills (paid or free).
> Compatible with agentsmarket.world. Adopted by anyone implementing the spec.

## Status

v1.0 (draft, 2026-09-12). Open for community feedback. License: CC0 (public domain dedication).

## Why this format

AI agents need a way to discover, understand, and invoke skills (paid or free API wrappers, MCP tools, OpenAPI endpoints, custom logic). Today each marketplace invents its own format:

- skills.sh: minimal markdown with title/description
- HuggingFace Spaces: README + metadata
- OpenAI GPTs: YAML config + system prompt
- MCP servers: `mcp.json` schema

**SKILL.md is the unified format.** One file describes one skill. Any marketplace can implement this spec and immediately onboard the same catalog.

## Format

A SKILL.md is a single Markdown file with two parts:

1. **YAML frontmatter** (between `---` fences) — machine-readable metadata
2. **Markdown body** — human- and LLM-readable documentation

### Required frontmatter fields

```yaml
---
name: string                    # Display name (kebab-case recommended)
description: string             # One-line summary (max 200 chars)
version: string                 # Semver (e.g., "1.2.0")
---
```

### Optional frontmatter fields

```yaml
---
# Author / ownership
author_name: string             # Human-readable name of author/seller
author_id: string               # Agent ID or DID (e.g., "ed25519:abc..." or "did:key:z6Mk...")
author_contact: string          # Email or URL for support (e.g., "support@example.com")

# Pricing
price_usdt: integer              # Price in micro-USDT (1 USDC = 1_000_000). 0 = free.
is_free: boolean                # Convenience flag. Default: price_usdt == 0.

# Discovery
tags: string[]                  # Categories (e.g., ["crypto", "trading", "api"])
public_preview: string          # Short preview shown in search results (max 500 chars)

# Compatibility
runtime: string                 # Required runtime (e.g., "node>=22", "python>=3.10", "any")
mcp_compatible: boolean         # Whether skill works via MCP tools
openapi_compatible: boolean     # Whether skill is a wrapper around an OpenAPI endpoint

# Safety
scan_score: integer             # 0-100, set by `agentsmarket scan` (or compatible scanner)
sha256: string                  # SHA-256 hash of the file body for integrity
---
```

### Body sections

After the frontmatter, the body MUST be valid Markdown. Recommended sections (in order):

```markdown
# Skill Name

## Description
Longer description (2-4 sentences). What does this skill do? When should an agent call it?

## Inputs
Schema of expected inputs. JSON Schema, TypeScript types, or plain English.

## Outputs
Schema of returned outputs.

## Examples
1-3 worked examples with realistic input/output.

## Errors
Common errors and what they mean.

## Pricing
(Optional) Per-call cost, any volume discounts, free tier limits.

## Versioning
(Optional) Changelog or upgrade notes.
```

### Complete example

```markdown
---
name: stripe-create-payment-intent
description: Create a Stripe payment intent for one-time or recurring payments
version: 1.0.0
author_name: Acme Payments
author_id: ed25519:7xK9pQ2vR3nL8mN1bV6cF4gH5jK8lM9nB2vC3xZ
author_contact: support@acme-payments.example
price_usdt: 1000
is_free: false
tags: [stripe, payments, fintech, api]
public_preview: |
  Creates a Stripe PaymentIntent given amount + currency. Returns the
  client_secret for frontend confirmation. Wraps Stripe's official
  /v1/payment_intents endpoint.
runtime: any
openapi_compatible: true
scan_score: 95
---

# stripe-create-payment-intent

## Description
Wraps Stripe's `POST /v1/payment_intents` endpoint. Returns the payment
intent object including `client_secret` for use with Stripe.js on the
frontend.

Use this skill when an agent needs to:
- Accept a payment from a user
- Set up a recurring subscription
- Authorize a hold on a card without immediate capture

## Inputs
```json
{
  "amount": 2000,            // integer, in smallest currency unit (cents)
  "currency": "usd",         // 3-letter ISO currency code
  "description": "Order #1234"  // optional, shown in Stripe dashboard
}
```

## Outputs
```json
{
  "id": "pi_3OqK7X2eZvKYlo2C1a2B3c4D",
  "client_secret": "pi_3OqK7X2eZvKYlo2C1a2B3c4D_secret_X8Y9Z0A1B2C3D4E5",
  "amount": 2000,
  "currency": "usd",
  "status": "requires_payment_method"
}
```

## Examples

**Create a $20 USD payment intent:**
```json
{ "amount": 2000, "currency": "usd" }
```
Returns `pi_...` with `client_secret`. Frontend uses `client_secret` with
Stripe Elements to collect card.

## Errors

- `card_declined` — card was declined by issuer
- `insufficient_funds` — not enough balance
- `expired_card` — card expiration date passed

## Pricing
$0.001 per call (1000 μUSDC). No free tier.

## Versioning
- 1.0.0 (2026-09-12): initial release
```

## Conformance

A marketplace or tool **conforms** to SKILL.md v1.0 if:

1. ✅ It can parse the YAML frontmatter and read all `Required` fields
2. ✅ It exposes skills via discovery (search by `tags`, `name`, `description`)
3. ✅ It can invoke skills with the documented `Inputs` and parse `Outputs`
4. ✅ It respects `price_usdt` (or rejects skills if can't bill)
5. ✅ It treats `scan_score` as a safety signal (warn users below threshold)

## Versioning policy

- **MAJOR** (1.0 → 2.0): breaking changes to required frontmatter or body structure
- **MINOR** (1.0 → 1.1): additive changes (new optional fields, new recommended sections)
- **PATCH** (1.0 → 1.0.1): clarifications, typo fixes

Tools parsing v1.0 MUST accept v1.x files (forward compat for additive fields).

## Adoption

- **agentsmarket.world**: full support (CLI `init`/`publish`, MCP `publish_skill`/`install_skill`)
- **Open source tooling**: `agentsmarket scan` validates SKILL.md files
- **Converters** (planned):
  - OpenAPI → SKILL.md
  - MCP `mcp.json` → SKILL.md (one tool = one skill)
  - HuggingFace Space → SKILL.md
  - OpenAI GPT config → SKILL.md

## Discussion

GitHub Discussions: https://github.com/agents-market/skill-md-spec/discussions (planned)

## License

CC0 1.0 Universal (public domain dedication). Anyone may implement, extend, or fork.
