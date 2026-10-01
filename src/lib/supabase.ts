import { createClient } from "@supabase/supabase-js";

// Clés publiques (publishable) du projet Supabase de la DCOP — sans danger côté navigateur.
const SUPABASE_URL = "https://yebrrcwlewbktsvggfrx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_V6Px8U6jSjPTYlKCZUPE9g_ekt8ivNi";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: typeof window !== "undefined",
    autoRefreshToken: typeof window !== "undefined",
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
