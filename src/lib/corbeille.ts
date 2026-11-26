import { supabase } from "@/lib/supabase";
import { logHistorique } from "@/lib/historique";
import { CORBEILLE_JOURS, PDF_BUCKET, type Convention } from "@/lib/conventions";

/** Mise en corbeille réversible (30 jours) avec trace dans l'historique. */
export async function mettreEnCorbeille(c: Convention): Promise<string | null> {
  const motif = window.prompt(
    `Mettre en corbeille la convention avec « ${c.partenaire_nom} » ?\nElle restera restaurable pendant ${CORBEILLE_JOURS} jours, puis sera supprimée définitivement.\n\nMotif (facultatif) :`,
    "",
  );
  if (motif === null) return "annule";
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("conventions")
    .update({
      supprime_le: new Date().toISOString(),
      supprime_par: u.user?.id ?? null,
      motif_suppression: motif.trim() || null,
    })
    .eq("id", c.id)
    .is("supprime_le", null);
  if (error) return "Mise en corbeille impossible : " + error.message;
  await logHistorique(c.id, "Mise en corbeille", motif.trim() || null);
  return null;
}

/** Destruction définitive : le PDF puis la convention ; les données liées suivent par cascade. */
export async function detruireConvention(c: Convention, confirmer = true): Promise<string | null> {
  if (confirmer) {
    const saisie = window.prompt(
      `Suppression DÉFINITIVE de « ${c.partenaire_nom} » et de son PDF. Action irréversible.\n\nPour confirmer, tapez le nom du partenaire : ${c.partenaire_nom}`,
    );
    if (saisie === null) return "annule";
    if (saisie.trim().toLowerCase() !== c.partenaire_nom.trim().toLowerCase()) {
      return "Nom du partenaire incorrect : suppression annulée.";
    }
  }
  if (c.pdf_path) {
    const { error } = await supabase.storage.from(PDF_BUCKET).remove([c.pdf_path]);
    if (error) return "Suppression du PDF impossible : " + error.message + ". La convention n'a pas été supprimée.";
  }
  const { error } = await supabase.from("conventions").delete().eq("id", c.id);
  return error ? "Suppression impossible : " + error.message : null;
}
