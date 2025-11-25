export type SearchPayload = {
  city: string;
  priceMax?: number;
  priceM2Max?: number;
  roomsFrom?: number;
  keywords?: string[];
  aiScoring?: boolean;
};

export type NormalizedSearchParams = {
  city: string;
  priceMax?: number;
  priceM2Max?: number;
  roomsFrom?: number;
  keywords: string[];
};

export type RawApifyListing = {
  id?: string | number;
  url?: string;
  title?: string;
  locality?: string;
  description?: string;
  price?: number;
  size?: number;
  area?: number;
  rooms?: number;
  images?: string[];
  [key: string]: unknown;
};

export type DerivedAttributes = {
  pricePerM2?: number;
  sizeM2?: number;
  layoutLabel?: string;
};

export type RealEstateItem = {
  id: string;
  title: string;
  url: string;
  location?: string;
  price?: number;
  sizeM2?: number;
  rooms?: number;
  images?: string[];
  description?: string;
  raw: RawApifyListing;
  derived: DerivedAttributes;
  aiScore?: number;
  aiReason?: string;
  aiHighlights?: string[];
};

export type ScoreRequestBody = {
  items: RealEstateItem[];
};

export type ScoreResult = Pick<RealEstateItem, "id" | "aiScore" | "aiReason" | "aiHighlights">;

export type ScoreResponseBody = {
  results: ScoreResult[];
};

