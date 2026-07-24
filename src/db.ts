import Database from "better-sqlite3";
import type BetterSqlite3 from "better-sqlite3";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { escapeFtsQuery } from "./utils.js";
import {
  type SearchFilters,
  type RestaurantRow,
  AWARD_ORDER,
  PAGE_SIZE,
} from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// When compiled, __dirname is build/. Go up one level to project root.
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.resolve(PROJECT_ROOT, "data", "michelin.db");

let db: BetterSqlite3.Database | null = null;

export function initDatabase(): BetterSqlite3.Database {
  if (db) return db;

  if (!fs.existsSync(DB_PATH)) {
    throw new Error(
      `Database not found at ${DB_PATH}. Run "npm run setup" first.`
    );
  }

  // Opened read-only: the DB's journal mode is already persisted in the file
  // header by the setup script, so no journal_mode pragma is needed here (it
  // would be a no-op on a WAL DB and throw on a non-WAL one).
  db = new Database(DB_PATH, { readonly: true });
  return db;
}

export function searchRestaurants(filters: SearchFilters): {
  total: number;
  page: number;
  totalPages: number;
  results: RestaurantRow[];
} {
  const conn = initDatabase();
  const conditions: string[] = [];
  const params: Record<string, string | number> = {};

  let usesFts = false;

  if (filters.query) {
    const escaped = escapeFtsQuery(filters.query);
    if (escaped) {
      usesFts = true;
      params.ftsQuery = escaped;
    } else {
      // A query was supplied but produced no searchable tokens (e.g. all
      // punctuation or whitespace). Treat this as a zero-match search rather
      // than silently dropping the filter and returning the entire table.
      const page = Math.max(1, filters.page || 1);
      return { total: 0, page, totalPages: 0, results: [] };
    }
  }

  if (filters.city) {
    conditions.push("r.city LIKE @city");
    params.city = `%${filters.city}%`;
  }
  if (filters.country) {
    conditions.push("r.country LIKE @country");
    params.country = `%${filters.country}%`;
  }
  if (filters.cuisine) {
    conditions.push("r.cuisine LIKE @cuisine");
    params.cuisine = `%${filters.cuisine}%`;
  }
  if (filters.award) {
    conditions.push("r.award = @award");
    params.award = filters.award;
  }
  if (filters.green_star !== undefined) {
    conditions.push("r.green_star = @greenStar");
    params.greenStar = filters.green_star ? 1 : 0;
  }
  if (filters.price_level !== undefined) {
    conditions.push("r.price_level = @priceLevel");
    params.priceLevel = filters.price_level;
  }

  const whereClause =
    conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  const awardCase = Object.entries(AWARD_ORDER)
    .map(([award, order]) => `WHEN '${award}' THEN ${order}`)
    .join(" ");
  const orderBy = `ORDER BY CASE r.award ${awardCase} ELSE 99 END, r.name`;

  const page = Math.max(1, filters.page || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let countSql: string;
  let selectSql: string;

  if (usesFts) {
    countSql = `
      SELECT COUNT(*) as total
      FROM restaurants r
      INNER JOIN restaurants_fts fts ON fts.rowid = r.id
      ${whereClause ? whereClause + " AND" : "WHERE"} restaurants_fts MATCH @ftsQuery
    `;
    selectSql = `
      SELECT r.*
      FROM restaurants r
      INNER JOIN restaurants_fts fts ON fts.rowid = r.id
      ${whereClause ? whereClause + " AND" : "WHERE"} restaurants_fts MATCH @ftsQuery
      ${orderBy}
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `;
  } else {
    countSql = `SELECT COUNT(*) as total FROM restaurants r ${whereClause}`;
    selectSql = `SELECT r.* FROM restaurants r ${whereClause} ${orderBy} LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
  }

  const totalRow = conn.prepare(countSql).get(params) as { total: number };
  const total = totalRow.total;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const results = conn.prepare(selectSql).all(params) as RestaurantRow[];

  return { total, page, totalPages, results };
}

export function getRestaurantByName(name: string): RestaurantRow[] {
  const conn = initDatabase();

  const exact = conn
    .prepare("SELECT * FROM restaurants WHERE name = @name LIMIT 10")
    .all({ name }) as RestaurantRow[];
  if (exact.length > 0) return exact;

  const like = conn
    .prepare("SELECT * FROM restaurants WHERE name LIKE @pattern LIMIT 10")
    .all({ pattern: `%${name}%` }) as RestaurantRow[];
  if (like.length > 0) return like;

  const ftsQuery = escapeFtsQuery(name);
  if (!ftsQuery) return [];

  return conn
    .prepare(
      `SELECT r.* FROM restaurants r
       INNER JOIN restaurants_fts fts ON fts.rowid = r.id
       WHERE restaurants_fts MATCH @query
       LIMIT 10`
    )
    .all({ query: ftsQuery }) as RestaurantRow[];
}

export function getRestaurantByUrl(url: string): RestaurantRow | undefined {
  const conn = initDatabase();
  return conn
    .prepare("SELECT * FROM restaurants WHERE url = @url")
    .get({ url }) as RestaurantRow | undefined;
}
