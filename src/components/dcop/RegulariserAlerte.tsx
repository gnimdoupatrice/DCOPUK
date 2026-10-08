import { useState } from "react";
import { CheckCircle, Clock, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Convention } from "@/lib/conventions";

export async function reporterAlerte(id: string, cibleLocale: string) {
  const targetIso = new Date(cibleLocale).toISOString();
  await supabase
    .from("conventions")
    .update({ alarme_reportee_jusqu_a: targetIso, alarme_arretee_le: null })
    .eq("id", id);
  await supabase.from("convention_historique").insert({
    convention_id: id,
    action: "Alerte reportée",
    note: `Alerte reportée jusqu'au ${new Date(cibleLocale).toLocaleString("fr-FR")}`,
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
    note: "Le Directeur a pris acte et a désactivé les sonneries de cette échéance.",
  });
  return nowIso;
}

export function defautReportLocal(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/** Fenêtre de régularisation manuelle d'une alerte dépassée sans action. */
export function RegulariserAlerte({
  convention,
  onClose,
  onDone,
}: {
  convention: Convention;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"choix" | "report">("choix");
  const [cible, setCible] = useState(defautReportLocal());
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    await fn();
    setBusy(false);
    onDone();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-bold text-uk-blue">Régulariser l'alerte</h2>
            <p className="mt-1 text-sm text-foreground">{convention.partenaire_nom}</p>
            <p className="text-xs text-destructive">Alerte dépassée sans aucune action</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {mode === "choix" ? (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode("report")}
              className="flex items-center justify-center gap-2 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Clock className="h-4 w-4 text-amber-600" /> Reporter l'alerte
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => arreterAlerte(convention.id))}
              className="flex items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground hover:brightness-110"
            >
              <CheckCircle className="h-4 w-4" /> Arrêter définitivement
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <p className="text-sm font-semibold text-foreground">Date et heure du prochain rappel :</p>
            <input
              type="datetime-local"
              value={cible}
              min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
              onChange={(e) => setCible(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
            {cible && new Date(cible).getTime() <= Date.now() && (
              <p className="text-xs font-medium text-destructive">Veuillez choisir une date et une heure futures.</p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setMode("choix")} className="rounded-lg border border-input px-3 py-2 text-xs font-medium hover:bg-muted">
                Retour
              </button>
              <button
                type="button"
                disabled={busy || !cible || new Date(cible).getTime() <= Date.now()}
                onClick={() => run(() => reporterAlerte(convention.id, cible))}
                className="rounded-lg bg-uk-blue px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                Confirmer le report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
