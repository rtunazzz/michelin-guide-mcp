# Michelin Guide MCP — Cloudflare Workers

Token-protected remote MCP server on Cloudflare Workers and D1. It exposes `search_restaurants`, `get_restaurant_detail`, and `search_latest_info` over Streamable HTTP at `/mcp`.

Search supports text, city, country, cuisine, award, Green Star, exact or ranged price levels, and Michelin Facilities & Services tags. Multiple `facilities` values are combined with AND; search results and detail responses include the parsed `facilities` tag array.

Adapted from [anhyobin/michelin-guide-mcp](https://github.com/anhyobin/michelin-guide-mcp), with data from [ngshiheng/michelin-my-maps](https://github.com/ngshiheng/michelin-my-maps).

## Local development

```sh
bun install
cp .dev.vars.example .dev.vars
bun run data:prepare
bun run data:local
bun run dev
```

Use `http://localhost:8787/mcp` with `Authorization: Bearer <token from .dev.vars>`.

## Cloudflare setup

```sh
bun run wrangler login
bun run wrangler d1 create michelin-guide
```

Copy the returned database ID into `wrangler.jsonc`, then import the data and deploy:

```sh
bun run data:prepare
bun run data:remote
bun run wrangler secret put MCP_TOKEN
bun run deploy
```

This fork's deployed endpoint is `https://michelin-guide-mcp.rtunaboss.workers.dev/mcp`. Other deployments will use their own `<worker>.<subdomain>.workers.dev/mcp` URL.

## MCP clients

Use the deployed `/mcp` URL with Streamable HTTP and send this header on every request:

```text
Authorization: Bearer <your-token>
```

Disable OAuth discovery for this connection if your client enables it by default. Use environment-variable substitution where supported instead of writing the real token into configuration or source control.

## Commands

- `bun run typecheck` — TypeScript checks
- `bun test` — unit tests
- `bun run data:prepare` — download the current CSV and generate SQL chunks
- `bun run data:local` / `bun run data:remote` — replace the selected D1 dataset

## Refreshing a live dataset

Do not import over a database serving production traffic; chunk imports are not atomic. Create a replacement database, import into that database, validate it, then put its ID in `wrangler.jsonc` and deploy:

```sh
bun run wrangler d1 create michelin-guide-v2
bun run data:prepare
bun scripts/import-data.ts --remote michelin-guide-v2
bun run wrangler d1 execute michelin-guide-v2 --remote \
  --command "SELECT COUNT(*) AS restaurants FROM restaurants; SELECT COUNT(*) AS fts_rows FROM restaurants_fts;"
```

The counts must match. Update `database_id`, run `bun run deploy`, and run the production smoke test before deleting the old database.
