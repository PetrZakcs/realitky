import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { fetchListingsFromApify } from "../../lib/apifyClient";
import { logger } from "../../lib/logger";
import { scoreRealEstateItems } from "../../lib/openaiScoring";
import { persistResults, persistSearch } from "../../lib/supabase";
import type {
  NormalizedSearchParams,
  RawApifyListing,
  RealEstateItem,
  SearchPayload,
  ScoreResult
} from "../../lib/types";

const searchSchema = z.object({
  city: z.string().min(2),
  priceMax: z.number().int().positive().optional(),
  priceM2Max: z.number().int().positive().optional(),
  roomsFrom: z.number().int().positive().optional(),
  keywords: z.array(z.string().trim().min(1)).optional(),
  aiScoring: z.boolean().optional()
});

type SearchResponse = {
  searchId: string;
  results: RealEstateItem[];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<SearchResponse | { error: string }>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const parsed = searchSchema.parse(req.body) as SearchPayload;
    const normalized = normalizePayload(parsed);
    const userId = (req.headers["x-user-id"] as string) ?? null;

    logger.info("Incoming search request", { normalized });

    const searchId = await persistSearch(parsed, userId);
    const rawListings = await fetchListingsFromApify(normalized);
    const processed = postProcessListings(rawListings, normalized);

    let enrichedResults = processed;
    if (parsed.aiScoring) {
      const scoreResults = await requestAiScoring(req, processed);
      enrichedResults = mergeScores(processed, scoreResults);
    }

    await persistResults(searchId, enrichedResults);

    return res.status(200).json({
      searchId,
      results: enrichedResults
    });
  } catch (error) {
    logger.error("Search endpoint failed", { error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}

const normalizePayload = (payload: SearchPayload): NormalizedSearchParams => ({
  city: payload.city.trim(),
  priceMax: payload.priceMax,
  priceM2Max: payload.priceM2Max,
  roomsFrom: payload.roomsFrom,
  keywords: payload.keywords?.map((k) => k.trim()).filter(Boolean) ?? []
});

const postProcessListings = (listings: RawApifyListing[], params: NormalizedSearchParams) => {
  const deduped = deduplicate(listings);
  const transformed = deduped.map(transformListing);

  return transformed.filter((item) => {
    if (params.priceM2Max && item.derived.pricePerM2 && item.derived.pricePerM2 > params.priceM2Max) {
      return false;
    }

    if (params.roomsFrom && item.rooms && item.rooms < params.roomsFrom) {
      return false;
    }

    return true;
  });
};

const deduplicate = (listings: RawApifyListing[]) => {
  const map = new Map<string, RawApifyListing>();
  listings.forEach((item) => {
    const key = item.url ?? String(item.id ?? Math.random());
    if (!map.has(key)) {
      map.set(key, item);
    }
  });
  return Array.from(map.values());
};

const transformListing = (item: RawApifyListing): RealEstateItem => {
  const size = item.size ?? item.area ?? parseSize(item.description ?? item.title ?? "");
  const price = item.price ?? parsePrice(item.description ?? "");
  const pricePerM2 = size && price ? Math.round(price / size) : undefined;

  return {
    id: createId(item),
    title: item.title ?? "Bez názvu",
    url: item.url ?? "#",
    location: item.locality,
    price,
    sizeM2: size,
    rooms: item.rooms ?? parseRooms(item.title ?? item.description ?? ""),
    images: Array.isArray(item.images) ? (item.images as string[]) : undefined,
    description: item.description,
    raw: item,
    derived: {
      pricePerM2,
      sizeM2: size,
      layoutLabel: deriveLayoutLabel(item.title ?? item.description ?? "")
    }
  };
};

const createId = (item: RawApifyListing) => {
  if (item.id) return String(item.id);
  if (item.url) return Buffer.from(item.url).toString("base64");
  return crypto.randomUUID();
};

const parseSize = (text: string) => {
  const match = text.match(/(\d+(\.\d+)?)\s?(m2|m²)/i);
  return match ? parseFloat(match[1]) : undefined;
};

const parsePrice = (text: string) => {
  const match = text.replace(/\s/g, "").match(/(\d{2,})\s?(Kc|CZK)?/i);
  return match ? Number(match[1]) : undefined;
};

const parseRooms = (text: string) => {
  const match = text.match(/(\d+)\s*\+?\s*kk/i);
  if (match) {
    return Number(match[1]);
  }

  const other = text.match(/(\d+)\s*kk/i);
  return other ? Number(other[1]) : undefined;
};

const deriveLayoutLabel = (text: string) => {
  const match = text.match(/\d+\s*\+\s*kk|\d+\s*kk/i);
  return match ? match[0] : undefined;
};

const getBaseUrl = (req: NextApiRequest) => {
  if (process.env.INTERNAL_API_BASE_URL) {
    return process.env.INTERNAL_API_BASE_URL;
  }

  const proto = (req.headers["x-forwarded-proto"] as string) ?? "http";
  const host = req.headers.host;
  if (!host) {
    return null;
  }

  return `${proto}://${host}`;
};

const requestAiScoring = async (req: NextApiRequest, items: RealEstateItem[]): Promise<ScoreResult[]> => {
  const baseUrl = getBaseUrl(req);

  if (!baseUrl) {
    logger.warn("Base URL not resolved, falling back to local scoring util");
    return scoreRealEstateItems(items);
  }

  try {
    const response = await fetch(`${baseUrl}/api/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items })
    });

    if (!response.ok) {
      throw new Error(`Score endpoint error: ${response.status}`);
    }

    const data = (await response.json()) as { results: ScoreResult[] };
    return data.results;
  } catch (error) {
    logger.error("Calling /api/score failed, falling back to local scoring util", { error });
    return scoreRealEstateItems(items);
  }
};

const mergeScores = (items: RealEstateItem[], scores: ScoreResult[]) => {
  const map = new Map(scores.map((s) => [s.id, s]));
  return items.map((item) => {
    const score = map.get(item.id);
    if (!score) return item;
    return {
      ...item,
      aiScore: score.aiScore,
      aiReason: score.aiReason,
      aiHighlights: score.aiHighlights
    };
  });
};

