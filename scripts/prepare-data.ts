import { parse } from "csv-parse/sync";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePriceLevel, parseLocation } from "../src/utils";

const CSV_URL = "https://raw.githubusercontent.com/ngshiheng/michelin-my-maps/main/data/michelin_my_maps.csv";
const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".data");
const CHUNK_SIZE = 500;

const schema = `
CREATE TABLE IF NOT EXISTS restaurants (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT DEFAULT '',
  location TEXT DEFAULT '',
  price TEXT DEFAULT '',
  cuisine TEXT DEFAULT '',
  longitude TEXT DEFAULT '',
  latitude TEXT DEFAULT '',
  phone_number TEXT DEFAULT '',
  url TEXT DEFAULT '',
  website_url TEXT DEFAULT '',
  award TEXT DEFAULT '',
  green_star INTEGER DEFAULT 0,
  facilities_and_services TEXT DEFAULT '',
  description TEXT DEFAULT '',
  city TEXT DEFAULT '',
  country TEXT DEFAULT '',
  price_level INTEGER DEFAULT 0
);
CREATE VIRTUAL TABLE IF NOT EXISTS restaurants_fts USING fts5(
  name,
  cuisine,
  location,
  description,
  content='restaurants',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);
DELETE FROM restaurants_fts;
DELETE FROM restaurants;
`;

function sql(value: string | number): string {
  return typeof value === "number" ? String(value) : `'${value.replaceAll("'", "''")}'`;
}

const response = await fetch(CSV_URL);
if (!response.ok) throw new Error(`CSV download failed: ${response.status} ${response.statusText}`);
const records = parse(await response.text(), {
  columns: true,
  skip_empty_lines: true,
  relax_quotes: true,
  relax_column_count: true,
}) as Record<string, string>[];

const seen = new Set<string>();
const rows = records.flatMap((row) => {
  const url = (row.Url || row.url || "").trim();
  if (seen.has(url)) return [];
  seen.add(url);
  const location = (row.Location || row.location || "").trim();
  const price = (row.Price || row.price || "").trim();
  const greenStar = (row.GreenStar || row["Green Star"] || row.greenStar || row.green_star || "").trim();
  return [{
    name: (row.Name || row.name || "").trim(),
    address: (row.Address || row.address || "").trim(),
    location,
    price,
    cuisine: (row.Cuisine || row.cuisine || "").trim(),
    longitude: (row.Longitude || row.longitude || "").trim(),
    latitude: (row.Latitude || row.latitude || "").trim(),
    phone_number: (row.PhoneNumber || row["Phone Number"] || row.phone_number || "").trim(),
    url,
    website_url: (row.WebsiteUrl || row["Website Url"] || row.website_url || "").trim(),
    award: (row.Award || row.award || "").trim(),
    green_star: greenStar === "1" || greenStar.toLowerCase() === "true" ? 1 : 0,
    facilities_and_services: (row.FacilitiesAndServices || row["Facilities And Services"] || row.facilities_and_services || "").trim(),
    description: (row.Description || row.description || "").trim(),
    ...parseLocation(location),
    price_level: normalizePriceLevel(price),
  }];
});

await rm(DATA_DIR, { recursive: true, force: true });
await mkdir(DATA_DIR, { recursive: true });
await writeFile(path.join(DATA_DIR, "0000-schema.sql"), schema);

const columns = ["name", "address", "location", "price", "cuisine", "longitude", "latitude", "phone_number", "url", "website_url", "award", "green_star", "facilities_and_services", "description", "city", "country", "price_level"] as const;
for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
  const statements: string[] = [];
  rows.slice(start, start + CHUNK_SIZE).forEach((row, index) => {
    const id = start + index + 1;
    statements.push(`INSERT INTO restaurants (id, ${columns.join(", ")}) VALUES (${[id, ...columns.map((column) => sql(row[column]))].join(", ")});`);
    statements.push(`INSERT INTO restaurants_fts(rowid, name, cuisine, location, description) VALUES (${[id, row.name, row.cuisine, row.location, row.description].map(sql).join(", ")});`);
  });
  await writeFile(path.join(DATA_DIR, `${String(start / CHUNK_SIZE + 1).padStart(4, "0")}-data.sql`), statements.join("\n"));
}

console.log(`Prepared ${rows.length} restaurants in ${Math.ceil(rows.length / CHUNK_SIZE)} data files.`);
