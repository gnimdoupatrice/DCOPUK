import { supabase } from "@/lib/supabase";

/** Ajoute une action à l'historique append-only d'une convention. */
export async function logHistorique(conventionId: string, action: string, note?: string | null) {
  await supabase.from("convention_historique").insert({ convention_id: conventionId, action, note: note || null });
}
