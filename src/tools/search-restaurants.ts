import { z } from "zod";
import { searchRestaurants } from "../db.js";
import { rowToSummary } from "../utils.js";
import type { SearchFilters } from "../types.js";

export const searchRestaurantsSchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Free text search query (FTS5 full-text search)"),
  city: z.string().optional().describe("City name (e.g., Tokyo, Paris, Seoul)"),
  country: z
    .string()
    .optional()
    .describe("Country name (e.g., Japan, France, South Korea)"),
  cuisine: z
    .string()
    .optional()
    .describe("Cuisine type (e.g., Japanese, French, Italian)"),
  award: z
    .enum([
      "1 Star",
      "2 Stars",
      "3 Stars",
      "Bib Gourmand",
      "Selected Restaurants",
    ])
    .optional()
    .describe("Michelin award level"),
  green_star: z
    .boolean()
    .optional()
    .describe("Whether the restaurant has a Michelin Green Star"),
  price_level: z
    .number()
    .int()
    .min(1)
    .max(4)
    .optional()
    .describe("Price level (1=budget to 4=luxury)"),
  page: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Page number (default: 1, 20 results per page)"),
});

export type SearchRestaurantsInput = z.infer<typeof searchRestaurantsSchema>;

export function handleSearchRestaurants(input: SearchRestaurantsInput): string {
  const filters: SearchFilters = {
    query: input.query,
    city: input.city,
    country: input.country,
    cuisine: input.cuisine,
    award: input.award,
    green_star: input.green_star,
    price_level: input.price_level,
    page: input.page,
  };

  const { total, page, totalPages, results } = searchRestaurants(filters);

  if (total === 0) {
    return JSON.stringify({
      total: 0,
      page: 1,
      totalPages: 0,
      results: [],
      message: "No restaurants found matching the given criteria.",
    });
  }

  const summaries = results.map(rowToSummary);

  return JSON.stringify({
    total,
    page,
    totalPages,
    results: summaries,
  });
}
