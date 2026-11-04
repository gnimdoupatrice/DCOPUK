import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { etatSuivi, type EtatSuivi, type ReceiptEnvoi } from "@/lib/alertes-email";
import { normaliserEmail } from "@/lib/projets";

const PASTILLE: Record<EtatSuivi, { cls: string; label: string }> = {
  envoye: { cls: "bg-emerald-500", label: "Transmis" },
  echec: { cls: "bg-destructive", label: "Non envoyé" },
  attente: { cls: "bg-amber-500", label: "En attente d'envoi" },
};

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "");

/** Liste sobre des destinataires d'alerte et de l'état de chaque e-mail. */
export function SuiviEmails({ conventionId, emailsAlerte, historique = false }: { conventionId: string; emailsAlerte: string[] | null | undefined; historique?: boolean }) {
  const [receipts, setReceipts] = useState<ReceiptEnvoi[]>([]);
  const [focaux, setFocaux] = useState<string[]>([]);
  const [indispo, setIndispo] = useState(false);

  useEffect(() => {
    let actif = true;
    void Promise.all([
      supabase.from("convention_email_envois").select("*").eq("convention_id", conventionId).order("moment_evenement", { ascending: false }),
      supabase.from("convention_points_focaux").select("email").eq("convention_id", conventionId).eq("recoit_alertes", true),
    ]).then(([r, f]) => {
      if (!actif) return;
      setIndispo(!!r.error);
      setReceipts((r.data ?? []) as ReceiptEnvoi[]);
      setFocaux(((f.data ?? []) as { email: string | null }[]).map((p) => p.email ?? "").filter(Boolean));
    });
    return () => {
      actif = false;
    };
  }, [conventionId]);

  const dernierMoment = receipts[0]?.moment_evenement;
  const derniers = receipts.filter((r) => r.moment_evenement === dernierMoment);
  const prevus = [...new Set([...(emailsAlerte ?? []), ...focaux].map(normaliserEmail).filter(Boolean))];
  const lignes = [...new Set([...derniers.map((r) => r.destinataire), ...prevus])].map((email) => ({
    email,
    r: derniers.find((x) => x.destinataire === email),
  }));
  const anciens = historique ? receipts.filter((r) => r.moment_evenement !== dernierMoment) : [];

  return (
    <div className="rounded-xl border border-border bg-background p-3 text-xs">
      <p className="mb-2 flex items-center gap-2 font-semibold text-foreground">
        <Mail className="h-4 w-4 text-uk-blue" /> Notification des parties prenantes
      </p>
      {indispo ? (
        <p className="text-muted-foreground">Le suivi des envois n'est pas encore activé sur la base de données.</p>
      ) : lignes.length === 0 ? (
        <p className="text-muted-foreground">Aucun destinataire partenaire ou point focal n'est inscrit aux alertes ; seule la Direction est prévenue.</p>
      ) : (
        <ul className="space-y-1.5">
          {lignes.map(({ email, r }) => {
            const etat = etatSuivi(r);
            return (
              <li key={email} className="flex items-start gap-2">
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${PASTILLE[etat].cls}`} aria-hidden />
                <span className="min-w-0">
                  <span className="break-all font-medium text-foreground">{email}</span>
                  <span className="block text-muted-foreground">
                    {PASTILLE[etat].label}
                    {r?.envoye_le && etat === "envoye" ? ` le ${fmt(r.envoye_le)}` : ""}
                    {r?.motif_erreur && etat !== "envoye" ? ` — ${r.motif_erreur}` : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {anciens.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-muted-foreground">Envois précédents ({anciens.length})</summary>
          <ul className="mt-2 space-y-1">
            {anciens.map((r) => (
              <li key={`${r.moment_evenement}-${r.type_evenement}-${r.destinataire}`} className="text-muted-foreground">
                {fmt(r.moment_evenement)} · {r.type_evenement === "report" ? "Rappel" : "Alerte"} · {r.destinataire} · {etatSuivi(r) === "envoye" ? "transmis" : r.motif_erreur ?? "non envoyé"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
