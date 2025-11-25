import { logger } from "./logger";
import { NormalizedSearchParams, RawApifyListing } from "./types";

const APIFY_BASE_URL = "https://api.apify.com/v2";
const DEFAULT_ACTOR_SLUG = "bebich~sreality-scraper";
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_DURATION_MS = 120000;

type ApifyRun = {
  data: {
    id: string;
    status: string;
    defaultDatasetId?: string;
  };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const buildActorInput = (params: NormalizedSearchParams) => {
  const filters: Record<string, unknown> = {
    city: params.city
  };

  if (params.priceMax) {
    filters.priceMax = params.priceMax;
  }

  if (params.priceM2Max) {
    filters.priceM2Max = params.priceM2Max;
  }

  if (params.roomsFrom) {
    filters.roomsFrom = params.roomsFrom;
  }

  if (params.keywords.length) {
    filters.keywords = params.keywords;
  }

  return filters;
};

export const fetchListingsFromApify = async (params: NormalizedSearchParams) => {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error("APIFY_TOKEN is not configured");
  }

  const actorSlug = process.env.APIFY_ACTOR_SLUG ?? DEFAULT_ACTOR_SLUG;
  const input = buildActorInput(params);

  logger.info("Triggering Apify actor", { actorSlug, input });

  const runResponse = await fetch(`${APIFY_BASE_URL}/acts/${actorSlug}/runs?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input })
  });

  if (!runResponse.ok) {
    const text = await runResponse.text();
    throw new Error(`Apify run creation failed: ${text}`);
  }

  const runJson = (await runResponse.json()) as ApifyRun;
  const runId = runJson?.data?.id;

  if (!runId) {
    throw new Error("Apify run id missing");
  }

  const datasetId = await pollRunForDataset(runId, token);
  const items = await downloadDataset(datasetId, token);

  logger.info("Apify dataset downloaded", { count: items.length });
  return items;
};

const pollRunForDataset = async (runId: string, token: string) => {
  const start = Date.now();

  while (Date.now() - start < MAX_POLL_DURATION_MS) {
    const statusResponse = await fetch(`${APIFY_BASE_URL}/actor-runs/${runId}?token=${token}`);

    if (!statusResponse.ok) {
      const text = await statusResponse.text();
      throw new Error(`Failed to poll Apify run: ${text}`);
    }

    const run = (await statusResponse.json()) as ApifyRun;
    const status = run.data.status;

    if (status === "SUCCEEDED") {
      const datasetId = run.data.defaultDatasetId;
      if (!datasetId) {
        throw new Error("Apify run succeeded but dataset id missing");
      }

      return datasetId;
    }

    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
      throw new Error(`Apify run ended with status ${status}`);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error("Apify run polling timed out");
};

const downloadDataset = async (datasetId: string, token: string) => {
  const datasetResponse = await fetch(
    `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${token}&clean=1`
  );

  if (!datasetResponse.ok) {
    const text = await datasetResponse.text();
    throw new Error(`Failed to download Apify dataset: ${text}`);
  }

  const items = (await datasetResponse.json()) as RawApifyListing[];
  return items;
};

