import { useEffect, useState, type FormEvent } from "react";
import { Archive, FilePlus2, FileText, History, Pencil, Printer, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  PDF_BUCKET,
  PDF_MAX_OCTETS,
  STATUT_INFO,
  ajouterMois,
  statutConvention,
  etatAlerte,
  libelleAlarme,
  SOUS_MENTION_ALERTE,
  formatDate,
  joursRestants,
  type Convention,
  type HistoriqueEntry,
} from "@/lib/conventions";

const inputCls =
  "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-uk-blue focus:ring-2 focus:ring-uk-blue/20";

export async function logHistorique(conventionId: string, action: string, note?: string | null) {
  await supabase.from("convention_historique").insert({ convention_id: conventionId, action, note: note || null });
}

export async function envoyerPdf(conventionId: string, file: File): Promise<string | null> {
  if (file.type !== "application/pdf") return "Seuls les fichiers PDF sont acceptés.";
  if (file.size > PDF_MAX_OCTETS) return "Le fichier dépasse 20 Mo.";
  const path = `${conventionId}/${Date.now()}.pdf`;
  const up = await supabase.storage.from(PDF_BUCKET).upload(path, file, { contentType: "application/pdf" });
  if (up.error) return "Envoi du PDF impossible : " + up.error.message;
  const { error } = await supabase.from("conventions").update({ pdf_path: path }).eq("id", conventionId);
  if (error) return "Enregistrement du PDF impossible : " + error.message;
  await logHistorique(conventionId, "Document PDF joint", file.name);
  return null;
}

type Panel = null | "avenant" | "archive";

export function ConventionDrawer({
  convention: c,
  onClose,
  onChanged,
  onEdit,
  onRegulariser,
}: {
  convention: Convention;
  onClose: () => void;
  onChanged: () => void;
  onEdit: () => void;
  onRegulariser?: () => void;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [historique, setHistorique] = useState<HistoriqueEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Avenant
  const [prolongation, setProlongation] = useState(12);
  const [noteAvenant, setNoteAvenant] = useState("");
  const nouvelleEcheance = ajouterMois(c.date_echeance, prolongation || 0);
  const [avDateAlerte, setAvDateAlerte] = useState("");
  const [avHeureAlerte, setAvHeureAlerte] = useState("08:00");

  // Archive
  const [noteArchive, setNoteArchive] = useState("");

  const jours = joursRestants(c.date_echeance);
  const statut = statutConvention(c);
  const etat = etatAlerte(c);

  useEffect(() => {
    // Proposition automatique : 3 mois avant la nouvelle échéance
    if (nouvelleEcheance) {
      setAvDateAlerte(ajouterMois(nouvelleEcheance, -3));
    }
  }, [nouvelleEcheance]);

  async function loadHistorique() {
    const { data } = await supabase
      .from("convention_historique")
      .select("*")
      .eq("convention_id", c.id)
      .order("created_at", { ascending: false });
    setHistorique((data ?? []) as HistoriqueEntry[]);
  }

  useEffect(() => {
    loadHistorique();
    setPanel(null);
    setError(null);
  }, [c.id]);

  async function run(fn: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    const err = await fn();
    setBusy(false);
    if (err) setError(err);
    else {
      setPanel(null);
      await loadHistorique();
      onChanged();
    }
  }

  function avenant(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      if (!prolongation || prolongation < 1) return "Indiquez une prolongation d'au moins 1 mois.";
      if (!avDateAlerte || !avHeureAlerte) return "Programmez la nouvelle alerte (date et heure) pour la nouvelle échéance.";
      const m = new Date(`${avDateAlerte}T${avHeureAlerte}`);
      if (m.getTime() <= Date.now()) return "La nouvelle alerte doit être fixée dans le futur.";
      if (avDateAlerte > nouvelleEcheance) return "La nouvelle alerte doit précéder ou égaler la nouvelle date d'échéance.";

      const { error } = await supabase
        .from("conventions")
        .update({
          duree_mois: c.duree_mois + prolongation,
          date_echeance: nouvelleEcheance,
          date_alerte: avDateAlerte,
          heure_alerte: avHeureAlerte,
          alarme_arretee_le: null,
          alarme_reportee_jusqu_a: null,
        })
        .eq("id", c.id);
      if (error) return error.message;

      await logHistorique(
        c.id,
        `Reconduction / avenant : +${prolongation} mois (échéance ${formatDate(c.date_echeance)} → ${formatDate(nouvelleEcheance)}) — nouvelle alerte le ${formatDate(avDateAlerte)} à ${avHeureAlerte}`,
        noteAvenant.trim(),
      );
      setNoteAvenant("");
      return null;
    });
  }

  function archiver(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      const { error } = await supabase
        .from("conventions")
        .update({ archived: true, archived_at: new Date().toISOString(), archive_note: noteArchive.trim() || null })
        .eq("id", c.id);
      if (error) return error.message;
      await logHistorique(c.id, "Convention clôturée / archivée", noteArchive.trim());
      setNoteArchive("");
      return null;
    });
  }

  function restaurer() {
    run(async () => {
      const { error } = await supabase
        .from("conventions")
        .update({ archived: false, archived_at: null, archive_note: null })
        .eq("id", c.id);
      if (error) return error.message;
      await logHistorique(c.id, "Convention réactivée");
      return null;
    });
  }

  async function supprimer() {
    const saisie = window.prompt(
      `Suppression définitive de la convention avec « ${c.partenaire_nom} » et de son document PDF.\nCette action est irréversible.\n\nTapez SUPPRIMER pour confirmer :`,
    );
    if (saisie?.trim().toUpperCase() !== "SUPPRIMER") return;
    setBusy(true);
    if (c.pdf_path) await supabase.storage.from(PDF_BUCKET).remove([c.pdf_path]);
    const { error } = await supabase.from("conventions").delete().eq("id", c.id);
    setBusy(false);
    if (error) setError("Suppression impossible : " + error.message);
    else {
      onChanged();
      onClose();
    }
  }

  async function voirPdf() {
    if (!c.pdf_path) return;
    const { data, error } = await supabase.storage.from(PDF_BUCKET).createSignedUrl(c.pdf_path, 600);
    if (error || !data) setError("Ouverture du PDF impossible.");
    else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function onPdf(file: File | undefined) {
    if (!file) return;
    run(async () => {
      const old = c.pdf_path;
      const err = await envoyerPdf(c.id, file);
      if (!err && old) await supabase.storage.from(PDF_BUCKET).remove([old]);
      return err;
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-foreground/40" onClick={onClose}>
      <aside
        role="dialog"
        aria-label={`Convention ${c.partenaire_nom}`}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-card shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-uk-blue px-6 py-5 text-primary-foreground">
          <div>
            <p className="text-xs uppercase tracking-wide opacity-80">{c.pole}</p>
            <h3 className="text-lg font-bold">{c.partenaire_nom}</h3>
            <p className="text-sm opacity-90">{c.cadre_juridique}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              title="Imprimer la fiche officielle"
              className="rounded-md border border-white/20 p-1.5 hover:bg-white/10"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button onClick={onClose} aria-label="Fermer" className="opacity-80 hover:opacity-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          {/* Décompte */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
            <div>
              <p className="text-xs text-muted-foreground">Décompte avant échéance</p>
              <p className="text-3xl font-extrabold text-uk-blue">
                {jours < 0 ? `Échue depuis ${-jours} jour${-jours > 1 ? "s" : ""}` : `J - ${jours} jour${jours > 1 ? "s" : ""}`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUT_INFO[statut].className}`}>
                {STATUT_INFO[statut].label}
              </span>
              {statut === "actif" && SOUS_MENTION_ALERTE[etat] && (
                <span className={`text-xs font-semibold ${SOUS_MENTION_ALERTE[etat]!.cls}`}>{SOUS_MENTION_ALERTE[etat]!.label}</span>
              )}
              <span className="text-right text-[11px] text-muted-foreground">{libelleAlarme(c)}</span>
              {statut === "actif" && etat === "depassee" && onRegulariser && (
                <button
                  type="button"
                  onClick={onRegulariser}
                  className="mt-1 rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:brightness-110"
                >
                  Régulariser (reporter ou arrêter)
                </button>
              )}
              {c.archived && (
                <span className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background">Clôturée / archivée</span>
              )}
            </div>
          </div>

          {/* Données */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Item label="Partenaire" value={c.partenaire_nom} full />
            <Item label="Pays" value={c.partenaire_pays} />
            <Item label="Ville" value={c.partenaire_ville || "—"} />
            <Item label="Thématique" value={c.thematique || "—"} full />
            <Item label="Pôle" value={c.pole} />
            <Item label="Cadre juridique" value={c.cadre_juridique} />
            <Item label="Date de signature" value={formatDate(c.date_signature)} />
            <Item label="Durée" value={`${c.duree_mois} mois`} />
            <Item label="Date d'échéance" value={formatDate(c.date_echeance)} />
            <Item
              label="Préavis de dénonciation"
              value={c.preavis_mois == null ? "Non renseigné" : `${c.preavis_mois} mois (avant le ${formatDate(ajouterMois(c.date_echeance, -c.preavis_mois) || c.date_echeance)})`}
            />
            <Item label="Type de reconduction" value={c.reconduction} />
            <Item label="Enregistrée le" value={new Date(c.created_at).toLocaleDateString("fr-FR")} />
            {c.archived && (
              <Item
                label="Clôture"
                value={`${c.archived_at ? new Date(c.archived_at).toLocaleDateString("fr-FR") : ""}${c.archive_note ? " — " + c.archive_note : ""}`}
                full
              />
            )}
          </dl>

          {/* PDF */}
          <div className="rounded-xl border border-border p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="h-4 w-4 text-uk-blue" /> Document officiel scanné
            </p>
            <div className="flex flex-wrap gap-2">
              {c.pdf_path ? (
                <button onClick={voirPdf} className="rounded-md bg-uk-blue px-3 py-1.5 text-sm font-semibold text-primary-foreground">
                  Ouvrir le PDF
                </button>
              ) : (
                <span className="text-sm text-muted-foreground">Aucun document joint.</span>
              )}
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                <Upload className="h-4 w-4" /> {c.pdf_path ? "Remplacer" : "Joindre un PDF"}
                <input type="file" accept="application/pdf" className="hidden" disabled={busy} onChange={(e) => onPdf(e.target.files?.[0])} />
              </label>
            </div>
          </div>

          {/* Actions du Directeur */}
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">Actions du Directeur</p>
            <div className="grid grid-cols-2 gap-2">
              <ActionBtn icon={FilePlus2} label="Reconduire / avenant" onClick={() => setPanel(panel === "avenant" ? null : "avenant")} tone="bg-uk-green text-white" />
              {c.archived ? (
                <ActionBtn icon={RotateCcw} label="Réactiver" onClick={restaurer} tone="bg-uk-orange text-white" />
              ) : (
                <ActionBtn icon={Archive} label="Archiver / clôturer" onClick={() => setPanel(panel === "archive" ? null : "archive")} tone="bg-uk-orange text-white" />
              )}
              <ActionBtn icon={Pencil} label="Modifier" onClick={onEdit} tone="bg-uk-blue text-primary-foreground" />
              <ActionBtn icon={Trash2} label="Supprimer" onClick={supprimer} tone="bg-destructive text-destructive-foreground" />
            </div>

            {panel === "avenant" && (
              <form onSubmit={avenant} className="mt-3 space-y-3 rounded-xl bg-muted p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Prolongation (mois) *
                    <input
                      type="number"
                      min={1}
                      required
                      value={prolongation}
                      onChange={(e) => setProlongation(Math.max(1, Number(e.target.value)))}
                      className={inputCls}
                    />
                  </label>
                  <div>
                    <span className="block text-xs font-medium text-muted-foreground">Nouvelle date d'échéance</span>
                    <p className="mt-2 text-sm font-bold text-uk-blue">
                      {nouvelleEcheance ? formatDate(nouvelleEcheance) : "—"}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs font-bold text-uk-blue">
                    Nouvelle alerte obligatoire pour cette reconduction
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Raccourcis calculés avant la nouvelle échéance :
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => nouvelleEcheance && setAvDateAlerte(ajouterMois(nouvelleEcheance, -6))}
                      className="rounded border border-border bg-muted px-2 py-1 text-xs hover:bg-border"
                    >
                      6 mois avant
                    </button>
                    <button
                      type="button"
                      onClick={() => nouvelleEcheance && setAvDateAlerte(ajouterMois(nouvelleEcheance, -3))}
                      className="rounded border border-uk-blue/30 bg-uk-blue/10 px-2 py-1 text-xs font-semibold text-uk-blue hover:bg-uk-blue/20"
                    >
                      3 mois avant (recommandé)
                    </button>
                    <button
                      type="button"
                      onClick={() => nouvelleEcheance && setAvDateAlerte(ajouterMois(nouvelleEcheance, -1))}
                      className="rounded border border-border bg-muted px-2 py-1 text-xs hover:bg-border"
                    >
                      1 mois avant
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="block text-xs font-medium text-muted-foreground">
                      Date de l'alerte *
                      <input
                        type="date"
                        required
                        max={nouvelleEcheance}
                        value={avDateAlerte}
                        onChange={(e) => setAvDateAlerte(e.target.value)}
                        className={inputCls}
                      />
                    </label>
                    <label className="block text-xs font-medium text-muted-foreground">
                      Heure de l'alerte *
                      <input
                        type="time"
                        required
                        value={avHeureAlerte}
                        onChange={(e) => setAvHeureAlerte(e.target.value)}
                        className={inputCls}
                      />
                    </label>
                  </div>
                </div>

                <label className="block text-xs font-medium text-muted-foreground">
                  Note sur l'avenant (motif, références du document)
                  <textarea
                    maxLength={1000}
                    rows={3}
                    value={noteAvenant}
                    onChange={(e) => setNoteAvenant(e.target.value)}
                    placeholder="Ex. : Avenant n°1 signé le 12/03/2026 prolongeant les activités d'un an."
                    className={inputCls}
                  />
                </label>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPanel(null)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-card"
                  >
                    Annuler
                  </button>
                  <button
                    disabled={busy}
                    className="rounded-md bg-uk-green px-4 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
                  >
                    {busy ? "Enregistrement…" : "Valider l'avenant"}
                  </button>
                </div>
              </form>
            )}

            {panel === "archive" && (
              <form onSubmit={archiver} className="mt-3 space-y-3 rounded-xl bg-muted p-4">
                <label className="block text-xs font-medium text-muted-foreground">
                  Motif de clôture
                  <textarea maxLength={1000} rows={3} value={noteArchive} onChange={(e) => setNoteArchive(e.target.value)} className={inputCls} />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPanel(null)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-card"
                  >
                    Annuler
                  </button>
                  <button disabled={busy} className="rounded-md bg-uk-orange px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                    Confirmer la clôture
                  </button>
                </div>
              </form>
            )}
            {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          </div>

          {/* Historique */}
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <History className="h-4 w-4 text-uk-blue" /> Historique
            </p>
            {historique.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune action enregistrée.</p>
            ) : (
              <ol className="space-y-3 border-l-2 border-border pl-4">
                {historique.map((h) => (
                  <li key={h.id} className="text-sm">
                    <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("fr-FR")}</p>
                    <p className="font-medium text-foreground">{h.action}</p>
                    {h.note && <p className="text-muted-foreground">{h.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Item({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, tone }: { icon: typeof Pencil; label: string; onClick: () => void; tone: string }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold hover:brightness-110 ${tone}`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
