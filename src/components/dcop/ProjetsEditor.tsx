import { useState } from "react";
import { Briefcase, Pencil, Plus, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/conventions";
import { DEVISES, budgetEnFcfa, formatMontant, projetVide, validerProjet, type ProjetSaisie } from "@/lib/projets";

const inputCls =
  "mt-1 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-uk-blue focus:ring-2 focus:ring-uk-blue/20";

type Item = ProjetSaisie & { id?: string };

function nettoyer(p: ProjetSaisie): ProjetSaisie {
  const t = (s: string | null) => (s && s.trim() ? s.trim() : null);
  return {
    ...p,
    titre: p.titre.trim(),
    description: t(p.description),
    activites: t(p.activites),
    apport_kara: t(p.apport_kara),
    apport_partenaire: t(p.apport_partenaire),
    lecons_apprises: t(p.lecons_apprises),
    date_debut: p.date_debut || null,
    date_fin: p.date_fin || null,
  };
}

export function ProjetsEditor({
  items,
  onSave,
  onRemove,
  busy,
  ouvrirAuDepart,
}: {
  items: Item[];
  /** index = null pour un ajout */
  onSave: (p: ProjetSaisie, index: number | null) => Promise<string | null> | string | null;
  onRemove: (item: Item, index: number) => void;
  busy?: boolean;
  ouvrirAuDepart?: boolean;
}) {
  const [edition, setEdition] = useState<number | "new" | null>(ouvrirAuDepart ? "new" : null);
  const [p, setP] = useState<ProjetSaisie>(projetVide());
  const [err, setErr] = useState<string | null>(null);
  const total = items.reduce((s, it) => s + budgetEnFcfa(it), 0);

  function ouvrir(i: number | "new") {
    setP(i === "new" ? projetVide() : { ...items[i]! });
    setErr(null);
    setEdition(i);
  }
  async function valider() {
    const propre = nettoyer(p);
    const e = validerProjet(propre);
    if (e) return setErr(e);
    const r = await onSave(propre, edition === "new" ? null : (edition as number));
    if (r) return setErr(r);
    setEdition(null);
  }

  return (
    <div className="space-y-2">
      {items.length === 0 && edition === null && <p className="text-xs text-muted-foreground">Aucun projet ou réalisation enregistré.</p>}
      {items.map((it, i) => (
        <div key={it.id ?? i} className="flex items-start justify-between gap-2 rounded-lg border border-border bg-card p-3 text-xs">
          <div className="min-w-0 space-y-0.5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Briefcase className="h-3.5 w-3.5 shrink-0 text-uk-green" />{it.titre}</p>
            {(it.date_debut || it.date_fin) && <p className="text-muted-foreground">Période : {formatDate(it.date_debut)} → {formatDate(it.date_fin)}</p>}
            {it.budget_montant != null && (
              <p className="font-medium text-uk-blue">
                Budget : {formatMontant(it.budget_montant, it.budget_devise ?? "FCFA")}
                {it.budget_devise && it.budget_devise !== "FCFA" && ` (≈ ${formatMontant(budgetEnFcfa(it))})`}
              </p>
            )}
            {it.description && <p className="text-muted-foreground">{it.description}</p>}
            {it.activites && <p><span className="font-semibold">Activités :</span> {it.activites}</p>}
            {it.apport_kara && <p><span className="font-semibold">Apport Kara :</span> {it.apport_kara}</p>}
            {it.apport_partenaire && <p><span className="font-semibold">Apport partenaire :</span> {it.apport_partenaire}</p>}
            {it.lecons_apprises && <p><span className="font-semibold">Retombées & leçons :</span> {it.lecons_apprises}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" disabled={busy} aria-label="Modifier le projet" onClick={() => ouvrir(i)} className="text-uk-blue hover:opacity-70"><Pencil className="h-3.5 w-3.5" /></button>
            <button type="button" disabled={busy} aria-label="Supprimer le projet" onClick={() => onRemove(it, i)} className="text-destructive hover:opacity-70"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      ))}
      {items.length > 0 && <p className="text-right text-xs font-semibold text-uk-blue">Total consolidé : {formatMontant(total)}</p>}

      {edition !== null ? (
        <div className="space-y-2 rounded-xl border border-uk-green/40 bg-uk-green/5 p-3 text-xs text-muted-foreground">
          <p className="text-sm font-semibold text-foreground">{edition === "new" ? "Nouveau projet / réalisation" : "Modifier le projet"}</p>
          <label className="block">Intitulé du projet *<input value={p.titre} onChange={(e) => setP({ ...p, titre: e.target.value })} className={inputCls} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label>Date de début<input type="date" value={p.date_debut ?? ""} onChange={(e) => setP({ ...p, date_debut: e.target.value })} className={inputCls} /></label>
            <label>Date de fin<input type="date" min={p.date_debut ?? undefined} value={p.date_fin ?? ""} onChange={(e) => setP({ ...p, date_fin: e.target.value })} className={inputCls} /></label>
          </div>
          <label className="block">Description / objectifs<textarea rows={2} value={p.description ?? ""} onChange={(e) => setP({ ...p, description: e.target.value })} className={inputCls} /></label>
          <label className="block">Activités concrètes menées<textarea rows={2} value={p.activites ?? ""} onChange={(e) => setP({ ...p, activites: e.target.value })} className={inputCls} /></label>
          <div className="grid grid-cols-3 gap-2">
            <label className="col-span-2">Budget<input type="number" min={0} step="any" value={p.budget_montant ?? ""} onChange={(e) => setP({ ...p, budget_montant: e.target.value === "" ? null : Number(e.target.value) })} className={inputCls} /></label>
            <label>Devise
              <select value={p.budget_devise ?? "FCFA"} onChange={(e) => setP({ ...p, budget_devise: e.target.value })} className={inputCls}>
                {DEVISES.map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
          </div>
          {p.budget_montant != null && p.budget_devise !== "FCFA" && <p className="font-medium text-uk-blue">≈ {formatMontant(budgetEnFcfa(p))}</p>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label>Apport de l'Université de Kara<input value={p.apport_kara ?? ""} onChange={(e) => setP({ ...p, apport_kara: e.target.value })} className={inputCls} /></label>
            <label>Apport du partenaire<input value={p.apport_partenaire ?? ""} onChange={(e) => setP({ ...p, apport_partenaire: e.target.value })} className={inputCls} /></label>
          </div>
          <label className="block">Retombées & leçons apprises<textarea rows={2} value={p.lecons_apprises ?? ""} onChange={(e) => setP({ ...p, lecons_apprises: e.target.value })} className={inputCls} /></label>
          {err && <p className="text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEdition(null)} className="rounded-md border border-border px-3 py-1.5">Annuler</button>
            <button type="button" disabled={busy} onClick={valider} className="rounded-md bg-uk-green px-3 py-1.5 font-semibold text-white disabled:opacity-50">
              {edition === "new" ? "Ajouter le projet" : "Enregistrer"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => ouvrir("new")} className="inline-flex items-center gap-1 rounded-md bg-uk-green px-3 py-1.5 text-xs font-semibold text-white">
          <Plus className="h-3.5 w-3.5" /> Ajouter un projet ou une réalisation
        </button>
      )}
    </div>
  );
}
