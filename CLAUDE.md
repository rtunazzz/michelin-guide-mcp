# Michelin Guide MCP — Cloudflare Workers

Cloudflare Workers + D1 adaptation of the upstream stdio MCP server. See README.md for architecture, setup, and deployment commands.

- Use bun for all JavaScript tooling.
- Never commit `.dev.vars`, `.data`, or real MCP tokens.
- Run `bun run typecheck` and `bun test` after changes.
- Exercise the deployed `/mcp` endpoint with `scripts/smoke.ts` before publishing deployment changes.
- Preserve the upstream and dataset MIT notices in LICENSE.
