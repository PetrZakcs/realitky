import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { logger } from "../../lib/logger";
import { scoreRealEstateItems } from "../../lib/openaiScoring";
import type { RealEstateItem, ScoreResponseBody } from "../../lib/types";

const realEstateSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  location: z.string().optional(),
  price: z.number().optional(),
  sizeM2: z.number().optional(),
  rooms: z.number().optional(),
  description: z.string().optional(),
  derived: z
    .object({
      pricePerM2: z.number().optional(),
      sizeM2: z.number().optional(),
      layoutLabel: z.string().optional()
    })
    .optional()
    .default({})
});

const bodySchema = z.object({
  items: z.array(realEstateSchema)
});

export default async function handler(req: NextApiRequest, res: NextApiResponse<ScoreResponseBody | { error: string }>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const parsed = bodySchema.parse(req.body);
    const items = parsed.items as RealEstateItem[];

    logger.info("Scoring request received", { count: items.length });

    const results = await scoreRealEstateItems(items);
    return res.status(200).json({ results });
  } catch (error) {
    logger.error("Score endpoint failed", { error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}

