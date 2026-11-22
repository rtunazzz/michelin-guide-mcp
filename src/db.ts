import {
  AWARD_ORDER,
  PAGE_SIZE,
  type RestaurantRow,
  type SearchFilters,
} from "./types";
import { escapeFtsQuery } from "./utils";

export async function searchRestaurants(db: D1Database, filters: SearchFilters) {
  const conditions: string[] = [];
  const bindings: (string | number)[] = [];
  const page = Math.max(1, filters.page || 1);

  if (filters.query) {
    const ftsQuery = escapeFtsQuery(filters.query);
    if (!ftsQuery) return { total: 0, page, totalPages: 0, results: [] };
    conditions.push("restaurants_fts MATCH ?");
    bindings.push(ftsQuery);
  }

  const addLike = (column: string, value?: string) => {
    if (!value) return;
    conditions.push(`r.${column} LIKE ?`);
    bindings.push(`%${value}%`);
  };
  addLike("city", filters.city);
  addLike("country", filters.country);
  addLike("cuisine", filters.cuisine);

  const addExact = (column: string, value?: string | number) => {
    if (value === undefined) return;
    conditions.push(`r.${column} = ?`);
    bindings.push(value);
  };
  addExact("award", filters.award);
  addExact("green_star", filters.green_star === undefined ? undefined : filters.green_star ? 1 : 0);
  addExact("price_level", filters.price_level);
  if (filters.min_price_level !== undefined) {
    conditions.push("r.price_level >= ?");
    bindings.push(filters.min_price_level);
  }
  if (filters.max_price_level !== undefined) {
    conditions.push("r.price_level <= ?");
    bindings.push(filters.max_price_level);
  }
  for (const facility of filters.facilities ?? []) {
    if (!facility.trim()) continue;
    conditions.push("INSTR(',' || REPLACE(LOWER(r.facilities_and_services), ' ', '') || ',', ',' || REPLACE(LOWER(?), ' ', '') || ',') > 0");
    bindings.push(facility.trim());
  }

  const from = filters.query
    ? "FROM restaurants r INNER JOIN restaurants_fts ON restaurants_fts.rowid = r.id"
    : "FROM restaurants r";
  const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  const awardCase = Object.entries(AWARD_ORDER)
    .map(([award, order]) => `WHEN '${award}' THEN ${order}`)
    .join(" ");
  const orderBy = ` ORDER BY CASE r.award ${awardCase} ELSE 99 END, r.name LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`;

  const countQuery = db.prepare(`SELECT COUNT(*) AS total ${from}${where}`);
  const selectQuery = db.prepare(`SELECT r.* ${from}${where}${orderBy}`);
  const [countRow, result] = await Promise.all([
    (bindings.length ? countQuery.bind(...bindings) : countQuery).first<{ total: number }>(),
    (bindings.length ? selectQuery.bind(...bindings) : selectQuery).all<RestaurantRow>(),
  ]);
  const total = countRow?.total ?? 0;
  return { total, page, totalPages: Math.ceil(total / PAGE_SIZE), results: result.results };
}

export async function getRestaurantByName(db: D1Database, name: string) {
  const exact = await db.prepare("SELECT * FROM restaurants WHERE name = ? LIMIT 10").bind(name).all<RestaurantRow>();
  if (exact.results.length) return exact.results;

  const like = await db.prepare("SELECT * FROM restaurants WHERE name LIKE ? LIMIT 10").bind(`%${name}%`).all<RestaurantRow>();
  if (like.results.length) return like.results;

  const ftsQuery = escapeFtsQuery(name);
  if (!ftsQuery) return [];
  const result = await db.prepare(
    `SELECT r.* FROM restaurants r
     INNER JOIN restaurants_fts ON restaurants_fts.rowid = r.id
     WHERE restaurants_fts MATCH ? LIMIT 10`,
  ).bind(ftsQuery).all<RestaurantRow>();
  return result.results;
}

export async function getRestaurantByUrl(db: D1Database, url: string) {
  return db.prepare("SELECT * FROM restaurants WHERE url = ?").bind(url).first<RestaurantRow>();
}
