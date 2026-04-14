import { parse } from "csv-parse/sync";
import Database from "better-sqlite3";
import { parseLocation, normalizePriceLevel } from "../utils.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// When compiled, __dirname is build/scripts/. Go up two levels to project root.
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.resolve(PROJECT_ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "michelin.db");
const CSV_URL =
  "https://raw.githubusercontent.com/ngshiheng/michelin-my-maps/main/data/michelin_my_maps.csv";

async function main() {
  console.log("Downloading CSV from ngshiheng/michelin-my-maps...");
  const response = await fetch(CSV_URL);
  if (!response.ok) {
    throw new Error(`Failed to download CSV: ${response.status} ${response.statusText}`);
  }
  const csvText = await response.text();
  console.log(`Downloaded ${(csvText.length / 1024).toFixed(0)} KB`);

  const records: Record<string, string>[] = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  });
  console.log(`Parsed ${records.length} records`);

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log("Removed existing database");
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT DEFAULT '',
      location TEXT DEFAULT '',
      price TEXT DEFAULT '',
      cuisine TEXT DEFAULT '',
      longitude TEXT DEFAULT '',
      latitude TEXT DEFAULT '',
      phone_number TEXT DEFAULT '',
      url TEXT DEFAULT '' UNIQUE,
      website_url TEXT DEFAULT '',
      award TEXT DEFAULT '',
      green_star INTEGER DEFAULT 0,
      facilities_and_services TEXT DEFAULT '',
      description TEXT DEFAULT '',
      city TEXT DEFAULT '',
      country TEXT DEFAULT '',
      price_level INTEGER DEFAULT 0
    );

    CREATE VIRTUAL TABLE restaurants_fts USING fts5(
      name,
      cuisine,
      location,
      description,
      content='restaurants',
      content_rowid='id',
      tokenize='unicode61 remove_diacritics 2'
    );

    CREATE INDEX idx_city ON restaurants(city);
    CREATE INDEX idx_country ON restaurants(country);
    CREATE INDEX idx_award ON restaurants(award);
    CREATE INDEX idx_cuisine ON restaurants(cuisine);
    CREATE INDEX idx_price_level ON restaurants(price_level);
    CREATE INDEX idx_green_star ON restaurants(green_star);
  `);

  const insert = db.prepare(`
    INSERT INTO restaurants (
      name, address, location, price, cuisine,
      longitude, latitude, phone_number, url, website_url,
      award, green_star, facilities_and_services, description,
      city, country, price_level
    ) VALUES (
      @name, @address, @location, @price, @cuisine,
      @longitude, @latitude, @phone_number, @url, @website_url,
      @award, @green_star, @facilities_and_services, @description,
      @city, @country, @price_level
    )
  `);

  const insertFts = db.prepare(`
    INSERT INTO restaurants_fts(rowid, name, cuisine, location, description)
    VALUES (@id, @name, @cuisine, @location, @description)
  `);

  const insertAll = db.transaction(
    (rows: Record<string, string>[]) => {
      let inserted = 0;
      const seen = new Set<string>();

      for (const row of rows) {
        const url = (row["Url"] || row["url"] || "").trim();
        if (seen.has(url)) continue;
        seen.add(url);

        const locationRaw = (row["Location"] || row["location"] || "").trim();
        const { city, country } = parseLocation(locationRaw);
        const priceRaw = (row["Price"] || row["price"] || "").trim();
        const greenStarRaw = (
          row["GreenStar"] ||
          row["Green Star"] ||
          row["greenStar"] ||
          row["green_star"] ||
          ""
        ).trim();

        const params = {
          name: (row["Name"] || row["name"] || "").trim(),
          address: (row["Address"] || row["address"] || "").trim(),
          location: locationRaw,
          price: priceRaw,
          cuisine: (row["Cuisine"] || row["cuisine"] || "").trim(),
          longitude: (row["Longitude"] || row["longitude"] || "").trim(),
          latitude: (row["Latitude"] || row["latitude"] || "").trim(),
          phone_number: (row["PhoneNumber"] || row["Phone Number"] || row["phone_number"] || "").trim(),
          url,
          website_url: (row["WebsiteUrl"] || row["Website Url"] || row["website_url"] || "").trim(),
          award: (row["Award"] || row["award"] || "").trim(),
          green_star: greenStarRaw === "1" || greenStarRaw.toLowerCase() === "true" ? 1 : 0,
          facilities_and_services: (
            row["FacilitiesAndServices"] ||
            row["Facilities And Services"] ||
            row["facilities_and_services"] ||
            ""
          ).trim(),
          description: (row["Description"] || row["description"] || "").trim(),
          city,
          country,
          price_level: normalizePriceLevel(priceRaw),
        };

        try {
          const result = insert.run(params);
          insertFts.run({
            id: result.lastInsertRowid,
            name: params.name,
            cuisine: params.cuisine,
            location: params.location,
            description: params.description,
          });
          inserted++;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!msg.includes("UNIQUE constraint")) {
            console.error(`Failed to insert ${params.name}: ${msg}`);
          }
        }
      }
      return inserted;
    }
  );

  const count = insertAll(records);
  console.log(`Inserted ${count} restaurants into database`);

  const total = db.prepare("SELECT COUNT(*) as count FROM restaurants").get() as { count: number };
  console.log(`Total rows in database: ${total.count}`);

  db.close();
  console.log(`Database created at ${DB_PATH}`);
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
