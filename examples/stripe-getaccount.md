---
name: stripe-getaccount
description: <p>Retrieves the details of an account.</p>
version: 1.0.0
author_name: stripe
author_id: 0xPLACEHOLDER_REPLACE_WITH_YOUR_AGENT_ID
author_contact: support@stripe.example
price_usdc: 1000
is_free: false
tags:
  - stripe
openapi_compatible: true
mcp_compatible: false
runtime: any
---

# stripe-getaccount

<p>Retrieves the details of an account.</p>

## API Endpoint

**GET** `/v1/account`

## Parameters

- `expand` (array) — Specifies which fields in the response should be expanded.

## Request Body

Content-Type: `application/x-www-form-urlencoded`

See OpenAPI spec for schema.

## Response

- **200**: Successful response.
- **default**: Error response.

## Authentication

Requires authentication per stripe API conventions. See OpenAPI spec for security schemes.

## Source

Generated from OpenAPI spec. Endpoint: `GET /v1/account`.
For canonical spec, see the OpenAPI source.
