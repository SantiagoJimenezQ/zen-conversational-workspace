# Security policy

This is a public proof of concept with synthetic account data. The public deployment must not be connected to a real account. Explicit local real mode supports a private key on loopback; it is not a publicly authenticated account service.

Report vulnerabilities using the repository’s private vulnerability reporting feature. Do not put credentials, exploit tokens or private user data in a public issue. If private reporting is unavailable, open an issue asking for a private reporting channel without including vulnerability details.

## Boundaries

- The mock MCP adapter has no network transport or account key. The feature flag defaults to mocks and Vercel forces mocks. The original real adapter is available only through explicit local configuration and fixed endpoints.
- Model traffic uses fixed OpenRouter endpoints, server-only credentials and rejected redirects. The dedicated model key’s verified lifetime cap limits model spending; anyone with public access may consume that budget.
- Instance-local fairness limits and same-origin checks are not authentication or distributed abuse protection. A determined visitor can exhaust the demo’s availability or budget. Add authentication and distributed rate controls before offering an uncapped service.
- Signed HttpOnly cookies isolate synthetic visitor state. State is temporary, bounded, evictable and may reset between serverless instances. It is not a durable database or transaction service.
- The model can propose simulated actions; explicit UI confirmation is still required. A scope classifier is fallible and is not an authorization control.
- Conversations are browser-local. Live prompts and selected tool context are sent to model providers; local real mode can include actual account data. Do not submit personal or confidential information.

Keep environment files, Vercel metadata, local ledgers, generated outputs and credentials out of Git. Use a unique signing secret of at least 32 characters in production. Read the latest local security review before changing these boundaries. A clean scan is not a guarantee that the app has no vulnerabilities.
