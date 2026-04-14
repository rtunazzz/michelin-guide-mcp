export interface Restaurant {
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
  green_star: boolean;
  facilities_and_services: string;
  description: string;
  city: string;
  country: string;
  price_level: number;
}

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
  award?: string;
  green_star?: boolean;
  price_level?: number;
  page?: number;
}

export interface SearchResult {
  total: number;
  page: number;
  totalPages: number;
  results: RestaurantSummary[];
}

export interface RestaurantSummary {
  name: string;
  award: string;
  city: string;
  country: string;
  cuisine: string;
  price_level: number;
  green_star: boolean;
  url: string;
}

export const AWARD_ORDER: Record<string, number> = {
  "3 Stars": 1,
  "2 Stars": 2,
  "1 Star": 3,
  "Bib Gourmand": 4,
  "Selected Restaurants": 5,
};

export const PAGE_SIZE = 20;
