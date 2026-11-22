import type { RestaurantRow } from "./types";

export function escapeFtsQuery(input: string): string {
  const tokens = input.replace(/["\-*()^~:]/g, " ").trim().split(/\s+/).filter(Boolean);
  return tokens.map((token) => `"${token}"`).join(" ");
}

export function parseLocation(location: string) {
  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return { city: "", country: "" };
  return { city: parts[0], country: parts.length === 1 ? parts[0] : parts.at(-1)! };
}

export function normalizePriceLevel(price: string): number {
  for (const symbol of ["$", "€", "£", "¥", "฿", "₩", "₫", "₺"]) {
    const count = price.split(symbol).length - 1;
    if (count) return Math.min(count, 4);
  }
  return 0;
}

export function parseFacilities(value: string): string[] {
  return value.split(",").map((facility) => facility.trim()).filter(Boolean);
}

export function rowToSummary(row: RestaurantRow) {
  return {
    name: row.name,
    award: row.award,
    city: row.city,
    country: row.country,
    cuisine: row.cuisine,
    price_level: row.price_level,
    green_star: row.green_star === 1,
    facilities: parseFacilities(row.facilities_and_services),
    url: row.url,
  };
}

export function rowToRestaurant(row: RestaurantRow) {
  return {
    name: row.name,
    address: row.address,
    location: row.location,
    price: row.price,
    cuisine: row.cuisine,
    longitude: row.longitude,
    latitude: row.latitude,
    phone_number: row.phone_number,
    url: row.url,
    website_url: row.website_url,
    award: row.award,
    green_star: row.green_star === 1,
    facilities_and_services: row.facilities_and_services,
    facilities: parseFacilities(row.facilities_and_services),
    description: row.description,
    city: row.city,
    country: row.country,
    price_level: row.price_level,
  };
}
