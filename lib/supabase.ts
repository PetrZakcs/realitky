import { createClient } from "@supabase/supabase-js";
import { RealEstateItem, SearchPayload } from "./types";

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are missing");
  }

  return createClient(url, key);
};

export const persistSearch = async (params: SearchPayload, userId?: string | null) => {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("searches")
    .insert({
      user_id: userId ?? null,
      params
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to persist search: ${error.message}`);
  }

  return data.id as string;
};

export const persistResults = async (searchId: string, items: RealEstateItem[]) => {
  if (!items.length) {
    return;
  }

  const client = getSupabaseClient();
  const payload = items.map((item) => ({
    search_id: searchId,
    data_json: item,
    ai_score: item.aiScore ?? null,
    ai_reason: item.aiReason ?? null
  }));

  const { error } = await client.from("results").insert(payload);
  if (error) {
    throw new Error(`Failed to persist results: ${error.message}`);
  }
};

