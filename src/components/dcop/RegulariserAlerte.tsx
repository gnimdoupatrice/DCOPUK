import { supabase } from "@/lib/supabase";

async function auteur(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? "utilisateur inconnu";
}

export async function reporterAlerte(id: string, cibleLocale: string) {
  const targetIso = new Date(cibleLocale).toISOString();
  await supabase
    .from("conventions")
    .update({ alarme_reportee_jusqu_a: targetIso, alarme_arretee_le: null })
    .eq("id", id);
  await supabase.from("convention_historique").insert({
    convention_id: id,
    action: "Alerte reportée",
    note: `Alerte reportée jusqu'au ${new Date(cibleLocale).toLocaleString("fr-FR")} par ${await auteur()}`,
  });
  return targetIso;
}

export async function arreterAlerte(id: string) {
  const nowIso = new Date().toISOString();
  await supabase
    .from("conventions")
    .update({ alarme_arretee_le: nowIso, alarme_reportee_jusqu_a: null })
    .eq("id", id);
  await supabase.from("convention_historique").insert({
    convention_id: id,
    action: "Alerte arrêtée définitivement",
    note: `${await auteur()} a pris acte et a désactivé les sonneries de cette échéance.`,
  });
  return nowIso;
}

