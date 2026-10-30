# Publication security review

Reviewed 30 October 2026. Scope: the standalone public preview and its initial publication candidate. This is a focused review, not an independent penetration test or a guarantee that no vulnerability exists.

## Findings addressed

- Excluded environment files, Vercel metadata, generated builds, screenshots, local ledgers and archives from publication.
- Removed the development-only shadcn CLI dependency, which pulled in deepmerge with low-severity advisory GHSA-gcqx-w48m-w2h4. Generated UI components remain. The full dependency audit subsequently reported zero known vulnerabilities.
- Rejected invalid origins before mock-session allocation; regression tests verify rejected requests receive no session cookie.
- Replaced full-session global refusal with bounded eviction of old synthetic state. Limited sessions to 100 per instance and mock catalog string arguments to 512 characters.
- Reused the validated signing key with strong production configuration and a secure local fallback. Cookies remain signed, HttpOnly, SameSite=Strict and Secure on Vercel.
- Rejected redirects for the fixed OpenRouter endpoints. The mock MCP adapter has no network transport or account credential.
- Added dependency audit and checksum-pinned Gitleaks history scanning to the read-only CI workflow; verified the existing action commit pins.

## Evidence

38 tests, lint, TypeScript and the production build passed. Tests cover mock no-network execution, session isolation, cross-conversation rejection, invalid origins, capacity handling, scope checks, explicit approvals and budget policy.

Gitleaks 8.30.1 scanned the publication candidate with redacted reporting. Its initial finding was the browser localStorage namespace, annotated on that exact non-secret assignment. The final scan found no credentials. A separate exact-value comparison with local configured credentials found no candidate matches; credential values were not printed or published.

The candidate excludes the original local account app, credentials, recordings and deck. No earlier Git history is imported. Full and production package audits reported zero known advisories after remediation. These are dated results, not a promise about future advisories.

## Residual limits

Anyone with public access may consume the dedicated OpenRouter budget. The provider key cap is the financial boundary; per-instance fairness and origin checks are not distributed abuse protection or authentication. Synthetic state may be evicted or reset between serverless instances. Scope classification can make mistakes. No real account should be connected, and visitors should not submit sensitive data.

No open-source license is granted for project code. Third-party notices remain in public/legal. See SECURITY.md for private reporting and deployment requirements.
