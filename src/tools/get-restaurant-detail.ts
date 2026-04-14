import { z } from "zod";
import { getRestaurantByName, getRestaurantByUrl } from "../db.js";
import { rowToRestaurant } from "../utils.js";

export const getRestaurantDetailSchema = z.object({
  name: z
    .string()
    .optional()
    .describe("Restaurant name (partial match supported)"),
  url: z
    .string()
    .optional()
    .describe("Michelin Guide URL for exact match"),
});

export type GetRestaurantDetailInput = z.infer<
  typeof getRestaurantDetailSchema
>;

export function handleGetRestaurantDetail(
  input: GetRestaurantDetailInput
): string {
  if (input.url) {
    const row = getRestaurantByUrl(input.url);
    if (!row) {
      return JSON.stringify({
        error: "No restaurant found with the given URL.",
        url: input.url,
      });
    }
    return JSON.stringify(rowToRestaurant(row));
  }

  if (input.name) {
    const rows = getRestaurantByName(input.name);
    if (rows.length === 0) {
      return JSON.stringify({
        error: "No restaurant found matching the given name.",
        name: input.name,
      });
    }
    if (rows.length === 1) {
      return JSON.stringify(rowToRestaurant(rows[0]));
    }
    return JSON.stringify({
      message: `Found ${rows.length} matching restaurants. Please be more specific or use a URL.`,
      matches: rows.map((r) => ({
        name: r.name,
        city: r.city,
        country: r.country,
        award: r.award,
        url: r.url,
      })),
    });
  }

  return JSON.stringify({
    error: "Either 'name' or 'url' must be provided.",
  });
}
