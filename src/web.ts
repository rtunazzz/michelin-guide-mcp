import { getRestaurantByName } from "./db";

function extractTextFromHtml(html: string): string {
  const text = html
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
  return text.length > 5000 ? `${text.substring(0, 5000)}...` : text;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MCP-Michelin-Guide/1.0)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok || !(response.headers.get("content-type") ?? "").includes("text/html")) return null;
    return response.text();
  } catch {
    return null;
  }
}

function looksLikeInterstitial(text: string): boolean {
  if (text.length < 200) return true;
  const markers = ["enable javascript", "captcha", "datadome", "access to this page has been denied", "verify you are a human"];
  const lower = text.toLowerCase();
  return markers.some((marker) => lower.includes(marker));
}

export async function searchLatestInfo(db: D1Database, restaurantName: string, location?: string) {
  const localResults = await getRestaurantByName(db, restaurantName);
  const match = location
    ? localResults.find((row) =>
        row.city.toLowerCase().includes(location.toLowerCase()) ||
        row.country.toLowerCase().includes(location.toLowerCase()))
    : localResults[0];

  if (match?.url) {
    const html = await fetchPage(match.url);
    if (html) {
      const text = extractTextFromHtml(html);
      if (!looksLikeInterstitial(text)) {
        return { source: "michelin_guide_page", url: match.url, verified: false, content: text };
      }
    }
  }

  const searchUrl = `https://guide.michelin.com/en/restaurants?q=${encodeURIComponent(location ? `${restaurantName} ${location}` : restaurantName)}`;
  const html = await fetchPage(searchUrl);
  if (html) {
    const text = extractTextFromHtml(html);
    if (!looksLikeInterstitial(text)) {
      return { source: "michelin_search", url: searchUrl, verified: false, content: text };
    }
  }

  return {
    source: "fallback",
    message: "Could not fetch information from the Michelin Guide website. The site may be temporarily unavailable or blocking automated access.",
    suggestion: `You can visit the Michelin Guide directly: ${searchUrl}`,
    local_data: match ? { name: match.name, award: match.award, city: match.city, country: match.country, url: match.url } : null,
  };
}
