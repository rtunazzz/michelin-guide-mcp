const baseUrl = process.argv[2] || "http://localhost:8787";
const token = process.env.MICHELIN_MCP_TOKEN;
if (!token) throw new Error("Set MICHELIN_MCP_TOKEN.");

export {};

const headers: Record<string, string> = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};

async function rpc(method: string, params?: unknown, id?: number) {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", ...(id === undefined ? {} : { id }), method, ...(params === undefined ? {} : { params }) }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}: ${body}`);
  if (!body) return { response, result: null };
  const data = body.startsWith("event:")
    ? JSON.parse(body.split("\n").find((line) => line.startsWith("data: "))!.slice(6))
    : JSON.parse(body);
  if (data.error) throw new Error(`${method}: ${JSON.stringify(data.error)}`);
  return { response, result: data.result };
}

const unauthorized = await fetch(`${baseUrl}/mcp`, { method: "POST", headers: { ...headers, Authorization: "Bearer wrong" }, body: "{}" });
if (unauthorized.status !== 401) throw new Error(`Expected 401 for a bad token, got ${unauthorized.status}`);

const initialized = await rpc("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "michelin-smoke-test", version: "1.0.0" },
}, 1);
const sessionId = initialized.response.headers.get("mcp-session-id");
if (sessionId) headers["Mcp-Session-Id"] = sessionId;
await rpc("notifications/initialized");
const tools = await rpc("tools/list", {}, 2);
const names = tools.result.tools.map((tool: { name: string }) => tool.name);
for (const expected of ["search_restaurants", "get_restaurant_detail", "search_latest_info"]) {
  if (!names.includes(expected)) throw new Error(`Missing tool: ${expected}`);
}

const search = await rpc("tools/call", {
  name: "search_restaurants",
  arguments: { city: "Tokyo", award: "3 Stars" },
}, 3);
const payload = JSON.parse(search.result.content[0].text);
if (!payload.total || !payload.results.length) throw new Error("Tokyo search returned no results.");

const restaurant = payload.results[0];
const detail = await rpc("tools/call", {
  name: "get_restaurant_detail",
  arguments: { url: restaurant.url },
}, 4);
const detailPayload = JSON.parse(detail.result.content[0].text);
if (!detailPayload.name) throw new Error(`Detail lookup failed: ${JSON.stringify(detailPayload)}`);

const latest = await rpc("tools/call", {
  name: "search_latest_info",
  arguments: { restaurant_name: restaurant.name, location: restaurant.city },
}, 5);
const latestPayload = JSON.parse(latest.result.content[0].text);
if (!latestPayload.source) throw new Error(`Latest-info lookup failed: ${JSON.stringify(latestPayload)}`);

const tagged = await rpc("tools/call", {
  name: "search_restaurants",
  arguments: { city: "Paris", facilities: ["Terrace"], max_price_level: 4 },
}, 6);
const taggedPayload = JSON.parse(tagged.result.content[0].text);
if (!taggedPayload.total || taggedPayload.results.some((row: { facilities: string[] }) =>
  !row.facilities.some((facility) => facility.toLowerCase() === "terrace"))) {
  throw new Error(`Facilities filtering returned invalid results: ${JSON.stringify(taggedPayload)}`);
}

console.log(`Connected; found ${tools.result.tools.length} tools. Search, tag/price filters, detail, and latest-info tools responded.`);
