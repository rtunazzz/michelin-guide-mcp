import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import { getRestaurantByName, getRestaurantByUrl, searchRestaurants } from "./db";
import { AWARDS } from "./types";
import { rowToRestaurant, rowToSummary } from "./utils";
import { searchLatestInfo } from "./web";

export interface Env {
  DB: D1Database;
  MCP_TOKEN: string;
}

const searchSchema = z.object({
  query: z.string().optional().describe("Free text search using FTS5"),
  city: z.string().optional().describe("City name, such as Tokyo, Paris, or Seoul"),
  country: z.string().optional().describe("Country name"),
  cuisine: z.string().optional().describe("Cuisine type, such as Japanese, French, or Italian"),
  award: z.enum(AWARDS).optional().describe("Michelin award level"),
  green_star: z.boolean().optional().describe("Whether the restaurant has a Michelin Green Star"),
  price_level: z.number().int().min(0).max(4).optional().describe("Exact price level: 0=unknown, 1=budget, 4=luxury"),
  min_price_level: z.number().int().min(0).max(4).optional().describe("Minimum price level; use 1 to exclude unpriced restaurants"),
  max_price_level: z.number().int().min(0).max(4).optional().describe("Maximum price level, useful for budget searches"),
  facilities: z.array(z.string()).optional().describe("Michelin Facilities & Services tags; every tag must match, such as Terrace or Wheelchair access"),
  page: z.number().int().min(1).optional().describe("Page number; 20 results per page"),
});

const detailSchema = z.object({
  name: z.string().trim().min(1).optional().describe("Restaurant name; partial matches are supported"),
  url: z.string().trim().min(1).optional().describe("Exact Michelin Guide restaurant URL"),
});

export const latestSchema = z.object({
  restaurant_name: z.string().trim().min(1).describe("Name of the restaurant"),
  location: z.string().optional().describe("City or country to narrow the search"),
});

function response(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

function createServer(db: D1Database) {
  const server = new McpServer({ name: "michelin-guide", version: "1.0.0" });

  server.registerTool(
    "search_restaurants",
    {
      description: "Search Michelin Guide restaurants by text, location, cuisine, award, Green Star, price range, and Facilities & Services tags",
      inputSchema: searchSchema,
    },
    async (filters) => {
      const result = await searchRestaurants(db, filters);
      return response(result.total ? { ...result, results: result.results.map(rowToSummary) } : {
        ...result,
        message: "No restaurants found matching the given criteria.",
      });
    },
  );

  server.registerTool(
    "get_restaurant_detail",
    {
      description: "Get full restaurant details by name or Michelin Guide URL",
      inputSchema: detailSchema,
    },
    async ({ name, url }) => {
      if (url) {
        const row = await getRestaurantByUrl(db, url);
        return response(row ? rowToRestaurant(row) : { error: "No restaurant found with the given URL.", url });
      }
      if (!name) return response({ error: "Either 'name' or 'url' must be provided." });

      const rows = await getRestaurantByName(db, name);
      if (!rows.length) return response({ error: "No restaurant found matching the given name.", name });
      if (rows.length === 1) return response(rowToRestaurant(rows[0]));
      return response({
        message: `Found ${rows.length} matching restaurants. Please be more specific or use a URL.`,
        matches: rows.map((row) => ({ name: row.name, city: row.city, country: row.country, award: row.award, url: row.url })),
      });
    },
  );

  server.registerTool(
    "search_latest_info",
    {
      description: "Fetch current information from the Michelin Guide website when local data is insufficient",
      inputSchema: latestSchema,
    },
    async ({ restaurant_name, location }) => response(await searchLatestInfo(db, restaurant_name, location)),
  );

  return server;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname !== "/mcp") return new Response("Not found", { status: 404 });
    const handler = createMcpHandler(() => createServer(env.DB), {
      // Browser preflights carry no token; every non-OPTIONS request still requires it.
      allowedOriginHostnames: "*",
    });
    if (request.method === "OPTIONS") return handler(request, env, ctx);
    if (!env.MCP_TOKEN) return new Response("MCP_TOKEN is not configured", { status: 500 });
    if (request.headers.get("Authorization") !== `Bearer ${env.MCP_TOKEN}`) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Bearer realm="michelin-guide"' },
      });
    }
    return handler(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
