# Lint dependency compatibility

All minimatch consumers resolve to 11.0.1 to address [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). The audit includes older lint-plugin dependencies as well as TypeScript ESLint's v10 dependency.

The pnpm patch changes only module exports: older plugins expect a callable CommonJS export or an ESM default, while current consumers use named exports. Every path still uses the upstream v11.0.1 matcher. No matching logic or security checks are changed, and the audit remains enabled at its existing threshold.

`tests/toolchain-glob.test.ts` exercises both module formats and an actual React lint rule with a glob-matched violation. Keep the exact override and patch together until upstream lint dependencies accept the fixed API, then remove them together after audit, lint and these regressions pass.
