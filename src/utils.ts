export function parseLocation(location: string): { city: string; country: string } {
  if (!location) return { city: "", country: "" };

  const parts = location.split(",").map((s) => s.trim());
  if (parts.length >= 2) {
    return {
      city: parts[0],
      country: parts[parts.length - 1],
    };
  }
  // Single-part locations are city-states (Singapore, Dubai, Macau, Abu Dhabi,
  // Luxembourg). Treat the sole token as both city and country so that a
  // country-filtered search resolves them instead of returning zero results.
  return { city: parts[0], country: parts[0] };
}

export function normalizePriceLevel(price: string): number {
  if (!price) return 0;
  // Michelin encodes price tiers as repeated currency glyphs (e.g. "$$", "€€€",
  // "฿฿"). Count occurrences of whichever glyph appears, capped at 4 tiers.
  const symbols = ["$", "€", "£", "¥", "฿", "₩", "₫", "₺"];
  for (const symbol of symbols) {
    // split()-based count avoids per-symbol regex escaping (e.g. "$").
    const count = price.split(symbol).length - 1;
    if (count > 0) return Math.min(count, 4);
  }
  return 0;
}

export function escapeFtsQuery(input: string): string {
  if (!input) return "";
  const escaped = input.replace(/["\-*()^~:]/g, " ").trim();
  const tokens = escaped.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";
  return tokens.map((t) => `"${t}"`).join(" ");
}

export function rowToSummary(row: {
  name: string;
  award: string;
  city: string;
  country: string;
  cuisine: string;
  price_level: number;
  green_star: number;
  url: string;
}) {
  return {
    name: row.name,
    award: row.award,
    city: row.city,
    country: row.country,
    cuisine: row.cuisine,
    price_level: row.price_level,
    green_star: row.green_star === 1,
    url: row.url,
  };
}

export function rowToRestaurant(row: {
  name: string;
  address: string;
  location: string;
  price: string;
  cuisine: string;
  longitude: string;
  latitude: string;
  phone_number: string;
  url: string;
  website_url: string;
  award: string;
  green_star: number;
  facilities_and_services: string;
  description: string;
  city: string;
  country: string;
  price_level: number;
}) {
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
    description: row.description,
    city: row.city,
    country: row.country,
    price_level: row.price_level,
  };
}
