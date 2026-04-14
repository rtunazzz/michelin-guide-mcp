import { z } from "zod";
import { getRestaurantByName } from "../db.js";

export const searchLatestInfoSchema = z.object({
  restaurant_name: z
    .string()
    .describe("Name of the restaurant to search for"),
  location: z
    .string()
    .optional()
    .describe("Location hint (city, country) to narrow search"),
});

export type SearchLatestInfoInput = z.infer<typeof searchLatestInfoSchema>;

function extractTextFromHtml(html: string): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length > 5000) {
    text = text.substring(0, 5000) + "...";
  }
  return text;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MCP-Michelin-Guide/1.0)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export async function handleSearchLatestInfo(
  input: SearchLatestInfoInput
): Promise<string> {
  const { restaurant_name, location } = input;

  const localResults = getRestaurantByName(restaurant_name);
  let michelinUrl: string | null = null;

  if (localResults.length > 0) {
    const match = location
      ? localResults.find(
          (r) =>
            r.city.toLowerCase().includes(location.toLowerCase()) ||
            r.country.toLowerCase().includes(location.toLowerCase())
        ) || localResults[0]
      : localResults[0];
    michelinUrl = match.url;
  }

  if (michelinUrl) {
    const html = await fetchPage(michelinUrl);
    if (html) {
      const text = extractTextFromHtml(html);
      return JSON.stringify({
        source: "michelin_guide_page",
        url: michelinUrl,
        content: text,
      });
    }
  }

  const searchQuery = encodeURIComponent(
    location
      ? `${restaurant_name} ${location}`
      : restaurant_name
  );
  const searchUrl = `https://guide.michelin.com/en/restaurants?q=${searchQuery}`;

  const html = await fetchPage(searchUrl);
  if (html) {
    const text = extractTextFromHtml(html);
    return JSON.stringify({
      source: "michelin_search",
      url: searchUrl,
      content: text,
    });
  }

  return JSON.stringify({
    source: "fallback",
    message:
      "Could not fetch information from the Michelin Guide website. The site may be temporarily unavailable or blocking automated access.",
    suggestion: `You can visit the Michelin Guide directly: ${searchUrl}`,
    local_data:
      localResults.length > 0
        ? {
            name: localResults[0].name,
            award: localResults[0].award,
            city: localResults[0].city,
            country: localResults[0].country,
            url: localResults[0].url,
          }
        : null,
  });
}
