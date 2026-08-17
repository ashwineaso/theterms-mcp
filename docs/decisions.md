# Decisions

## SDK version (2026-08-17)

This project targets the v1.x line of `@modelcontextprotocol/sdk`, specifically version **1.30.0** — the latest published 1.x release as of today. The v1.x line provides a stable, unified SDK package for building MCP servers, as opposed to the newer v2.x split architecture (`@modelcontextprotocol/server`, `@modelcontextprotocol/client`, `@modelcontextprotocol/core`).

Install command: `npm install @modelcontextprotocol/sdk@^1.30.0`

## `engines.node` floor (2026-08-17)

Set to `>=22` rather than the `>=20` suggested as a default in the task
brief. Node 20 reached end-of-life on 2026-04-30 (confirmed via
nodejs.org/en/about/eol as of today), so publishing a new package today
with a `>=20` floor would recommend an unsupported runtime to consumers.
Node 22 is Maintenance LTS (EOL 2027-04-30). This also happens to satisfy
npm's Trusted Publishing requirement that publishes run under npm CLI
>=11.5.1, which itself requires Node >=22.14.0 — so CI's publish workflow
uses `actions/setup-node` with `node-version: '22'`, matching `engines.node`.

## Build tooling: TypeScript version (2026-08-17, revised same day)

Initially pinned to `^7.0.2` (the `latest` dist-tag) — TypeScript 7.0 (GA
July/August 2026, the native Go-ported compiler) ships under the same
`typescript` package name and `tsc` CLI, and empirically preserves the
`#!/usr/bin/env node` shebang in compiled output with no postbuild step.
That entry flagged 7.0's recency as an open risk and named `^5.9.3` as
the fallback.

**Revised to `^5.9.3`** once that risk materialized concretely: adding
ESLint (`typescript-eslint@8.67.0`) failed with `ERESOLVE` because its
peer range is `typescript >=4.8.4 <6.1.0` — the wider TS tooling
ecosystem hasn't caught up to TS 7 yet. Re-verified after the downgrade:
`tsc` 5.9.3 still preserves the shebang identically, `npm run
build`/`typecheck`/`lint` all still pass clean, and a from-scratch
`npm ci` installs without any peer-dependency errors.

## npm Trusted Publishing bootstrap order (2026-08-17)

Confirmed via npm's docs and current community writeups: npm's web UI for
configuring a package's "Trusted Publisher" (npmjs.com package settings →
Trusted Publisher → GitHub Actions) only exists for packages that already
exist on the registry — there is no way to pre-register trusted publishing
for a name with zero published versions. This is a real chicken-and-egg
constraint (unlike PyPI, which allows pre-registration). Required order:
1. A human publishes an initial version manually (`npm publish` from a
   logged-in, 2FA-verified local session) to create `@theterms/mcp` on the
   registry.
2. The human then configures the Trusted Publisher on
   npmjs.com/package/@theterms/mcp/access, pointing at
   `ashwineaso/theterms-mcp` + `.github/workflows/publish.yml`.
3. All subsequent publishes go through `publish.yml` via OIDC — no
   `NPM_TOKEN` stored. See the Task 2 report for exact steps.
