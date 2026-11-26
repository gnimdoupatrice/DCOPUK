import { useState } from "react";
import { AlertTriangle, RotateCcw, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { detruireConvention } from "@/lib/corbeille";
import { logHistorique } from "@/lib/historique";
import {
  CORBEILLE_JOURS,
  alerteEchueARestaurer,
  formatDate,
  joursAvantPurge,
  trouverDoublonStrict,
  type Convention,
} from "@/lib/conventions";

type Etape = { c: Convention; type: "doublon"; doublon: Convention } | { c: Convention; type: "alerte" };

export function Corbeille({
  corbeille,
  actives,
  onClose,
  onChanged,
}: {
  corbeille: Convention[];
  actives: Convention[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [etape, setEtape] = useState<Etape | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("08:00");

  function signaler(msg: string | null) {
    if (msg && msg !== "annule") setErreur(msg);
  }

  async function restaurerEffectif(c: Convention, maj: Record<string, unknown> = {}, note?: string) {
    setBusy(true);
    const { error } = await supabase
      .from("conventions")
      .update({ supprime_le: null, supprime_par: null, motif_suppression: null, ...maj })
      .eq("id", c.id);
    setBusy(false);
    if (error) return setErreur("Restauration impossible : " + error.message);
    await logHistorique(c.id, "Restauration depuis la corbeille", note ?? null);
    setEtape(null);
    onChanged();
  }

  function suiteApresDoublon(c: Convention) {
    if (alerteEchueARestaurer(c)) {
      setDate("");
      setEtape({ c, type: "alerte" });
    } else void restaurerEffectif(c);
  }

  function demarrerRestauration(c: Convention) {
    setErreur(null);
    const doublon = trouverDoublonStrict(c, actives);
    if (doublon) setEtape({ c, type: "doublon", doublon });
    else suiteApresDoublon(c);
  }

  async function detruire(c: Convention) {
    setErreur(null);
    setBusy(true);
    const msg = await detruireConvention(c);
    setBusy(false);
    if (msg) return signaler(msg);
    setEtape(null);
    onChanged();
  }

  async function viderTout() {
    if (!window.confirm(`Supprimer définitivement les ${corbeille.length} convention(s) de la corbeille ? Action irréversible.`)) return;
    setBusy(true);
    for (const c of corbeille) {
      const msg = await detruireConvention(c, false);
      if (msg) setErreur(msg);
    }
    setBusy(false);
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-4xl rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Corbeille</h2>
            <p className="text-xs text-muted-foreground">Conventions restaurables pendant {CORBEILLE_JOURS} jours, puis supprimées définitivement. Aucune alarme ni e-mail n'est émis pendant ce séjour.</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="rounded-md p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        {erreur && <p className="mx-4 mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erreur}</p>}

        {etape?.type === "doublon" && (
          <div className="m-4 rounded-lg border border-uk-orange bg-uk-orange/10 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-foreground"><AlertTriangle className="h-4 w-4 text-uk-orange" /> Doublon détecté</p>
            <p className="mt-1 text-muted-foreground">
              Une convention active identique existe déjà : « {etape.doublon.partenaire_nom} », {etape.doublon.pole}, signée le {formatDate(etape.doublon.date_signature)}, fin le {formatDate(etape.doublon.date_echeance)}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => void detruire(etape.c)} className="rounded-md bg-destructive px-3 py-1.5 font-semibold text-destructive-foreground">Supprimer définitivement cette copie</button>
              <button disabled={busy} onClick={() => suiteApresDoublon(etape.c)} className="rounded-md border border-border px-3 py-1.5 font-semibold">Restaurer quand même</button>
              <button onClick={() => setEtape(null)} className="rounded-md px-3 py-1.5 text-muted-foreground">Annuler</button>
            </div>
          </div>
        )}

        {etape?.type === "alerte" && (
          <div className="m-4 rounded-lg border border-destructive bg-destructive/5 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-foreground"><AlertTriangle className="h-4 w-4 text-destructive" /> Alerte déjà passée</p>
            <p className="mt-1 text-muted-foreground">La date d'alerte de « {etape.c.partenaire_nom} » est déjà passée. Choisissez avant de restaurer :</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="text-xs">Nouvelle date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5 text-sm" /></label>
              <label className="text-xs">Heure<input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5 text-sm" /></label>
              <button
                disabled={busy || !date || new Date(`${date}T${heure}`).getTime() <= Date.now()}
                onClick={() => void restaurerEffectif(etape.c, { date_alerte: date, heure_alerte: heure, alarme_reportee_jusqu_a: null, alarme_arretee_le: null }, `Alerte reprogrammée au ${formatDate(date)} à ${heure}`)}
                className="rounded-md bg-uk-blue px-3 py-1.5 font-semibold text-primary-foreground disabled:opacity-50"
              >Reprogrammer l'alerte</button>
              <button disabled={busy} onClick={() => void restaurerEffectif(etape.c, { alarme_arretee_le: new Date().toISOString() }, "Alerte arrêtée définitivement à la restauration")} className="rounded-md border border-border px-3 py-1.5 font-semibold">Arrêter définitivement l'alerte</button>
              <button onClick={() => setEtape(null)} className="rounded-md px-3 py-1.5 text-muted-foreground">Annuler</button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto p-4">
          {corbeille.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">La corbeille est vide.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-2">Partenaire</th><th className="p-2">Pôle</th><th className="p-2">Mise en corbeille</th><th className="p-2">Motif</th><th className="p-2">Purge</th><th className="p-2 text-right">Actions</th></tr>
              </thead>
              <tbody>
                {corbeille.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="p-2 font-semibold text-foreground">{c.partenaire_nom}</td>
                    <td className="p-2">{c.pole}</td>
                    <td className="p-2">{c.supprime_le ? new Date(c.supprime_le).toLocaleString("fr-FR") : "—"}</td>
                    <td className="p-2 text-muted-foreground">{c.motif_suppression || "—"}</td>
                    <td className="p-2"><span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{joursAvantPurge(c)} j restants</span></td>
                    <td className="p-2">
                      <div className="flex justify-end gap-1.5">
                        <button disabled={busy} onClick={() => demarrerRestauration(c)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold text-uk-blue hover:bg-muted"><RotateCcw className="h-3.5 w-3.5" /> Restaurer</button>
                        <button disabled={busy} onClick={() => void detruire(c)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive hover:text-destructive-foreground"><Trash2 className="h-3.5 w-3.5" /> Supprimer définitivement</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {corbeille.length > 0 && (
          <div className="flex justify-end border-t border-border p-4">
            <button disabled={busy} onClick={() => void viderTout()} className="rounded-md bg-destructive px-3 py-1.5 text-sm font-semibold text-destructive-foreground">Vider la corbeille</button>
          </div>
        )}
      </div>
    </div>
  );
}
