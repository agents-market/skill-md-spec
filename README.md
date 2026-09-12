# SKILL.md Specification

> A vendor-neutral format for describing AI-agent-callable skills (paid or free).

## What is this?

SKILL.md is a single Markdown file format that describes one AI skill — its inputs, outputs, pricing, author, and behavior. Any marketplace or tool can implement this spec and immediately onboard the same catalog of skills.

## Why this format?

AI agents need a way to discover, understand, and invoke skills. Today each marketplace invents its own format:

- skills.sh: minimal markdown with title/description
- HuggingFace Spaces: README + metadata
- OpenAI GPTs: YAML config + system prompt
- MCP servers: `mcp.json` schema

SKILL.md is the unified format. **One file, one skill, any marketplace.**

## Quick example

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
tags: [stripe, payments, fintech]
public_preview: |
  Creates a Stripe PaymentIntent given amount + currency.
runtime: any
openapi_compatible: true
scan_score: 95
---

# stripe-create-payment-intent

## Description
Wraps Stripe's `POST /v1/payment_intents` endpoint.

## Inputs
```json
{ "amount": 2000, "currency": "usd" }
```

## Outputs
```json
{
  "id": "pi_...",
  "client_secret": "pi_..._secret_...",
  "amount": 2000,
  "currency": "usd",
  "status": "requires_payment_method"
}
```

## Pricing
$0.001 USDC per call (1000 μUSDC).
```

## Spec version

**v1.0** (draft, 2026-09-12). See [SPEC.md](SPEC.md) for the full format definition.

## Status

- **v1.0**: draft, open for community feedback
- License: CC0 1.0 (public domain dedication)

## Adoption

| Tool | Status |
|------|--------|
| agentsmarket.world | ✅ Full support (CLI + MCP) |
| OpenAPI → SKILL.md converter | ✅ Implemented |
| MCP mcp.json → SKILL.md converter | 📋 Planned |
| HuggingFace Spaces → SKILL.md | 📋 Planned |
| OpenAI GPT config → SKILL.md | 📋 Planned |

## Contributing

We welcome PRs to SPEC.md. Please open an issue first to discuss substantial changes.

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

CC0 1.0 Universal — see [LICENSE](LICENSE).

Anyone may implement, extend, or fork without attribution.
