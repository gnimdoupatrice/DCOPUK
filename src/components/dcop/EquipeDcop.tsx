import { useEffect, useState } from "react";
import { Copy, Link2, UserCheck, UserX, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { expirationInvitation, genererJeton, hacherJeton, VALIDITE_INVITATION_JOURS } from "@/lib/equipe";

interface Membre {
  user_id: string; email: string; nom: string; prenom: string; poste: string; pole: string; telephone: string; cree_le: string;
  role: string; actif: boolean;
}

export async function compterEnAttente(): Promise<number> {
  const { count } = await supabase.from("dcop_roles").select("user_id", { count: "exact", head: true }).eq("actif", false);
  return count ?? 0;
}

export function EquipeDcop({ moi, onClose, onChanged }: { moi: string; onClose: () => void; onChanged?: () => void }) {
  const [membres, setMembres] = useState<Membre[]>([]);
  const [lien, setLien] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function charger() {
    const [p, r] = await Promise.all([
      supabase.from("dcop_profils").select("*").order("cree_le", { ascending: false }),
      supabase.from("dcop_roles").select("user_id, role, actif"),
    ]);
    if (p.error || r.error) return setErr("Lecture de l’équipe impossible. Le script d’équipe a-t-il été exécuté ?");
    const roles = new Map((r.data ?? []).map((x) => [x.user_id as string, x]));
    setMembres((p.data ?? []).map((x) => ({ ...(x as Membre), role: roles.get(x.user_id)?.role ?? "agent", actif: !!roles.get(x.user_id)?.actif })));
  }
  useEffect(() => { void charger(); }, []);

  async function generer() {
    setBusy(true); setErr(null); setCopie(false);
    const jeton = genererJeton();
    const { error } = await supabase.from("dcop_invitations").insert({ jeton_hash: await hacherJeton(jeton), expire_le: expirationInvitation().toISOString() });
    setBusy(false);
    if (error) return setErr("Génération du lien impossible.");
    setLien(`${window.location.origin}/enrolement#${jeton}`);
  }

  async function basculer(m: Membre) {
    const { error } = await supabase.from("dcop_roles").update({ actif: !m.actif }).eq("user_id", m.user_id);
    if (error) return setErr("Mise à jour impossible.");
    await charger(); onChanged?.();
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-foreground/40" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-uk-blue px-5 py-4 text-primary-foreground">
          <h2 className="font-display text-lg font-bold">Équipe DCOP & accès</h2>
          <button onClick={onClose} aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-6 p-5">
          <section className="rounded-xl border border-border p-4">
            <p className="text-sm text-foreground/80">
              Générez un lien unique (valable {VALIDITE_INVITATION_JOURS} jours, un seul usage) et transmettez-le à l’agent. Il créera lui-même son compte, qui restera en consultation seule jusqu’à votre activation.
            </p>
            <button onClick={generer} disabled={busy} className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-uk-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <Link2 className="h-4 w-4" /> Générer un lien d’invitation
            </button>
            {lien && (
              <div className="mt-3 flex gap-2">
                <input readOnly value={lien} className="min-w-0 flex-1 rounded-md border border-input bg-muted px-2 py-1.5 text-xs" onFocus={(e) => e.target.select()} />
                <button onClick={() => { void navigator.clipboard.writeText(lien); setCopie(true); }} className="inline-flex items-center gap-1 rounded-md bg-uk-blue px-3 text-xs font-semibold text-primary-foreground">
                  <Copy className="h-3.5 w-3.5" /> {copie ? "Copié" : "Copier"}
                </button>
              </div>
            )}
          </section>
          {err && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{err}</p>}
          <section className="space-y-3">
            <h3 className="font-bold text-uk-blue">Membres</h3>
            {membres.length === 0 && <p className="text-sm text-muted-foreground">Aucun agent enrôlé pour l’instant.</p>}
            {membres.map((m) => (
              <div key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-foreground">{m.prenom} {m.nom} <span className="font-normal text-muted-foreground">— {m.poste}</span></p>
                  <p className="text-xs text-muted-foreground">{m.pole} · {m.email} · {m.telephone}</p>
                  <p className="text-xs text-muted-foreground">Enrôlé le {new Date(m.cree_le).toLocaleDateString("fr-FR")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${m.actif ? "bg-uk-green/15 text-uk-green" : "bg-uk-orange/15 text-uk-orange"}`}>
                    {m.actif ? "Actif" : "En attente d’activation"}
                  </span>
                  {m.user_id !== moi && m.role === "agent" && (
                    <button onClick={() => basculer(m)} className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold text-white ${m.actif ? "bg-destructive" : "bg-uk-green"}`}>
                      {m.actif ? <><UserX className="h-3.5 w-3.5" /> Suspendre</> : <><UserCheck className="h-3.5 w-3.5" /> Activer le compte</>}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
