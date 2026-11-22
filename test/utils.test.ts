import { expect, test } from "bun:test";
import { escapeFtsQuery, normalizePriceLevel, parseFacilities, parseLocation, rowToRestaurant, rowToSummary } from "../src/utils";
import type { RestaurantRow } from "../src/types";

const row: RestaurantRow = {
  name: "Test Restaurant",
  address: "1 Test Street",
  location: "Paris, France",
  price: "€€€",
  cuisine: "French",
  longitude: "2.3",
  latitude: "48.8",
  phone_number: "",
  url: "https://guide.michelin.com/test",
  website_url: "",
  award: "1 Star",
  green_star: 1,
  facilities_and_services: "Air conditioning,Terrace, Wheelchair access",
  description: "Description",
  city: "Paris",
  country: "France",
  price_level: 3,
};

test("escapes FTS operators and preserves terms", () => {
  expect(escapeFtsQuery('French "modern": (Paris)')).toBe('"French" "modern" "Paris"');
  expect(escapeFtsQuery("- * :")).toBe("");
});

test("parses locations and price levels", () => {
  expect(parseLocation("Tokyo, Japan")).toEqual({ city: "Tokyo", country: "Japan" });
  expect(parseLocation("Singapore")).toEqual({ city: "Singapore", country: "Singapore" });
  expect(parseLocation("Dubai")).toEqual({ city: "Dubai", country: "Dubai" });
  expect(normalizePriceLevel("€€€")).toBe(3);
  expect(normalizePriceLevel("$$$$$")).toBe(4);
});

test("converts Green Star and facilities for public responses", () => {
  expect(parseFacilities(row.facilities_and_services)).toEqual(["Air conditioning", "Terrace", "Wheelchair access"]);
  expect(parseFacilities("Pets allowed only in outdoor dining areas (patio/terrace)")).not.toContain("Terrace");
  expect(rowToSummary(row).green_star).toBe(true);
  expect(rowToSummary(row).facilities).toEqual(["Air conditioning", "Terrace", "Wheelchair access"]);
  expect(rowToRestaurant(row).green_star).toBe(true);
  expect(rowToRestaurant(row).facilities).toEqual(["Air conditioning", "Terrace", "Wheelchair access"]);
  expect(rowToRestaurant(row)).not.toHaveProperty("id");
});
