export const AWARDS = [
  "1 Star",
  "2 Stars",
  "3 Stars",
  "Bib Gourmand",
  "Selected Restaurants",
] as const;

export interface RestaurantRow {
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
}

export interface SearchFilters {
  query?: string;
  city?: string;
  country?: string;
  cuisine?: string;
  award?: (typeof AWARDS)[number];
  green_star?: boolean;
  price_level?: number;
  min_price_level?: number;
  max_price_level?: number;
  facilities?: string[];
  page?: number;
}

export const AWARD_ORDER: Record<string, number> = {
  "3 Stars": 1,
  "2 Stars": 2,
  "1 Star": 3,
  "Bib Gourmand": 4,
  "Selected Restaurants": 5,
};

export const PAGE_SIZE = 20;
