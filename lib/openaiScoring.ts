import OpenAI from "openai";
import { logger } from "./logger";
import { RealEstateItem, ScoreResult } from "./types";

const getClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  return new OpenAI({ apiKey });
};

const SYSTEM_PROMPT =
  "Jsi analytik investičních nemovitostí. Hodnoť návratnost, " +
  "rizika a zajímavé parametry. Odpovídej pouze platným JSONem.";

type OpenAIScoreSchema = {
  score: number;
  reasoning: string;
  highlights: string[];
};

const parseScore = (response: string): OpenAIScoreSchema => {
  try {
    const parsed = JSON.parse(response) as OpenAIScoreSchema;
    return {
      score: Math.min(100, Math.max(0, parsed.score)),
      reasoning: parsed.reasoning ?? "",
      highlights: parsed.highlights ?? []
    };
  } catch (error) {
    logger.error("Failed to parse OpenAI response", { error });
    return {
      score: 0,
      reasoning: "OpenAI response could not be parsed.",
      highlights: []
    };
  }
};

export const scoreRealEstateItems = async (items: RealEstateItem[]): Promise<ScoreResult[]> => {
  if (!items.length) {
    return [];
  }

  const client = getClient();
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  const results: ScoreResult[] = [];
  for (const item of items) {
    const completion = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Ohodnoť následující nemovitost a vrať JSON { "score": 0-100, "reasoning": "...", "highlights": ["..."] }:
${JSON.stringify(
  {
    title: item.title,
    price: item.price,
    sizeM2: item.sizeM2,
    rooms: item.rooms,
    location: item.location,
    derived: item.derived,
    description: item.description
  },
  null,
  2
)}
`
        }
      ]
    });

    const message = completion.choices[0]?.message?.content ?? "{}";
    const parsed = parseScore(message);
    results.push({
      id: item.id,
      aiScore: parsed.score,
      aiReason: parsed.reasoning,
      aiHighlights: parsed.highlights
    });
  }

  return results;
};

