import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  searchRestaurantsSchema,
  handleSearchRestaurants,
} from "./tools/search-restaurants.js";
import {
  getRestaurantDetailSchema,
  handleGetRestaurantDetail,
} from "./tools/get-restaurant-detail.js";
import {
  searchLatestInfoSchema,
  handleSearchLatestInfo,
} from "./tools/search-web.js";

const server = new McpServer({
  name: "michelin-guide",
  version: "1.0.0",
});

server.registerTool(
  "search_restaurants",
  {
    description:
      "Search Michelin Guide restaurants by multiple criteria: free text, city, country, cuisine, award level, green star, and price level. Returns paginated results sorted by award level.",
    inputSchema: searchRestaurantsSchema.shape,
  },
  async (params) => ({
    content: [{ type: "text", text: handleSearchRestaurants(params) }],
  })
);

server.registerTool(
  "get_restaurant_detail",
  {
    description:
      "Get detailed information about a specific Michelin Guide restaurant by name (partial match) or Michelin Guide URL. Returns all 15 fields including description, facilities, contact info, and coordinates.",
    inputSchema: getRestaurantDetailSchema.shape,
  },
  async (params) => ({
    content: [{ type: "text", text: handleGetRestaurantDetail(params) }],
  })
);

server.registerTool(
  "search_latest_info",
  {
    description:
      "Search for the latest information about a restaurant from the Michelin Guide website. Use when local database information is insufficient or you need the most current details.",
    inputSchema: searchLatestInfoSchema.shape,
  },
  async (params) => ({
    content: [{ type: "text", text: await handleSearchLatestInfo(params) }],
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Server error:", err);
  process.exit(1);
});
