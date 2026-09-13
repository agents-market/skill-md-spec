---
name: stripe-all-endpoints
description: >-
  Router for 3 stripe API endpoints. Provide a natural-language task; this skill finds the right endpoint and returns
  its child skill_name for invocation.
version: 1.0.0
author_name: stripe
author_id: 0xPLACEHOLDER_REPLACE_WITH_YOUR_AGENT_ID
author_contact: support@stripe.example
price_usdc: 0
is_free: true
tags:
  - stripe
  - router
  - meta
openapi_compatible: true
mcp_compatible: true
runtime: any
---

# stripe-all-endpoints

Router for 3 stripe API endpoints.

## Usage

Provide a natural-language task. This skill returns the matching child `skill_name` and endpoint.
Then invoke the child skill separately with the required parameters.

## Inputs

- `task` (string, required): Natural language description of what you want to do.

## Output

- `matched_skill` (string): The child skill_name to invoke.
- `endpoint` (string): The HTTP endpoint (`METHOD /path`).
- `confidence` (string): "exact", "partial", or "none".

## Routing

```yaml
routes:
  - id: route_1
    skill_name: stripe-getaccount
    keywords: ["stripe", "getaccount", "retrieve", "account", "v1"]
    endpoint: GET /v1/account
    summary: "Retrieve account"
  - id: route_2
    skill_name: stripe-postaccountlinks
    keywords: ["stripe", "postaccountlinks", "create", "account", "link", "v1", "account_links"]
    endpoint: POST /v1/account_links
    summary: "Create an account link"
  - id: route_3
    skill_name: stripe-postaccountsessions
    keywords: ["stripe", "postaccountsessions", "create", "account", "session", "v1", "account_sessions"]
    endpoint: POST /v1/account_sessions
    summary: "Create an Account Session"
```

## Note

This parent skill does NOT execute the API call itself. It only identifies which child skill should be invoked. The agent then calls the child skill separately with the required parameters.

For simple use, prefer the individual child skills directly.

Generated from OpenAPI spec. 3 endpoints indexed.
