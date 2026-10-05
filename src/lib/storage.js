import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Every device that opens this site reads and writes the same row —
// that's what makes the data shared across every phone.
const ROW_ID = "main";

export async function loadAppData() {
  const { data, error } = await supabase
    .from("rudley_app_data")
    .select("payload")
    .eq("id", ROW_ID)
    .maybeSingle();

  if (error) {
    console.error("Load failed", error);
    return null;
  }
  return data ? data.payload : null;
}

export async function saveAppData(payload) {
  const { error } = await supabase
    .from("rudley_app_data")
    .upsert({ id: ROW_ID, payload, updated_at: new Date().toISOString() });

  if (error) console.error("Save failed", error);
}
