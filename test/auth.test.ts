import { expect, test } from "bun:test";
import worker, { type Env } from "../src/index";

const context = {} as ExecutionContext;
const request = (token?: string) => new Request("https://example.com/mcp", {
  method: "POST",
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});
const env = (MCP_TOKEN?: string): Env => ({ DB: {} as D1Database, MCP_TOKEN: MCP_TOKEN as string });

test("rejects missing and incorrect tokens", async () => {
  expect((await worker.fetch(request("wrong"), env("secret"), context)).status).toBe(401);
  expect((await worker.fetch(request(), env("secret"), context)).status).toBe(401);
});

test("fails closed when the token secret is missing or empty", async () => {
  expect((await worker.fetch(request("undefined"), env(), context)).status).toBe(500);
  expect((await worker.fetch(request(""), env(""), context)).status).toBe(500);
});

test("allows CORS preflight without exposing MCP methods", async () => {
  const response = await worker.fetch(new Request("https://example.com/mcp", {
    method: "OPTIONS",
    headers: {
      Origin: "https://client.example",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type",
    },
  }), env("secret"), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
});
