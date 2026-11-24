import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import ukEmblem from "@/assets/uk-emblem.png";
import { DEFAULT_POLES } from "@/lib/conventions";
import { erreursEnrolement, MOT_DE_PASSE_MIN, type Enrolement } from "@/lib/equipe";

export const Route = createFileRoute("/enrolement")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Enrôlement agent — DCOP Université de Kara" },
      { name: "description", content: "Création de votre compte agent de la DCOP via un lien d’invitation du Directeur." },
      { property: "og:title", content: "Enrôlement agent — DCOP Université de Kara" },
      { property: "og:description", content: "Formulaire d’enrôlement des agents de la DCOP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EnrolementPage,
});

const VIDE: Enrolement = { nom: "", prenom: "", poste: "", pole: "", telephone: "", email: "", motDePasse: "" };

function EnrolementPage() {
  const [jeton, setJeton] = useState("");
  const [etat, setEtat] = useState<"verif" | "invalide" | "form" | "fait">("verif");
  const [msg, setMsg] = useState<string | null>(null);
  const [f, setF] = useState<Enrolement>(VIDE);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const j = window.location.hash.replace(/^#/, "");
    setJeton(j);
    fetch("/api/public/enrolement", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "verifier", jeton: j }) })
      .then(async (r) => {
        if (r.ok) setEtat("form");
        else { setMsg(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Lien invalide."); setEtat("invalide"); }
      })
      .catch(() => { setMsg("Connexion impossible. Réessayez."); setEtat("invalide"); });
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const err = erreursEnrolement(f);
    if (f.motDePasse !== confirm) err.push("Les deux mots de passe ne correspondent pas.");
    if (err.length) return setMsg(err.join(" "));
    setBusy(true); setMsg(null);
    const r = await fetch("/api/public/enrolement", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, jeton }) }).catch(() => null);
    setBusy(false);
    if (r?.ok) { window.history.replaceState(null, "", "/enrolement"); setEtat("fait"); }
    else setMsg(((await r?.json().catch(() => ({}))) as { error?: string } | undefined)?.error ?? "Enrôlement impossible.");
  }

  const champ = (k: keyof Enrolement, label: string, type = "text", auto?: string) => (
    <label className="block text-sm">
      <span className="font-semibold text-foreground">{label}</span>
      <input type={type} autoComplete={auto} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" required />
    </label>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-uk-blue px-4 py-10 font-body">
      <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-3">
          <img src={ukEmblem} alt="Université de Kara" className="h-12 w-12 object-contain" />
          <div>
            <h1 className="font-display text-xl font-bold text-uk-blue">Enrôlement agent DCOP</h1>
            <p className="text-xs text-muted-foreground">Université de Kara — Espace Privé</p>
          </div>
        </div>
        {etat === "verif" && <p className="text-sm text-muted-foreground">Vérification du lien d’invitation…</p>}
        {etat === "invalide" && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{msg}</p>}
        {etat === "fait" && (
          <div className="space-y-3 text-sm">
            <p className="rounded-md bg-uk-green/10 p-3 text-foreground">
              Votre compte est créé. Vous pouvez déjà vous connecter et consulter l’Espace Privé ; les actions seront débloquées dès que le Directeur aura activé votre compte.
            </p>
            <Link to="/service-prive" className="inline-block rounded-md bg-uk-blue px-4 py-2 font-semibold text-primary-foreground">Se connecter</Link>
          </div>
        )}
        {etat === "form" && (
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {champ("nom", "Nom", "text", "family-name")}
              {champ("prenom", "Prénom", "text", "given-name")}
            </div>
            {champ("poste", "Poste occupé")}
            <label className="block text-sm">
              <span className="font-semibold text-foreground">Pôle d’affectation</span>
              <select value={f.pole} onChange={(e) => setF({ ...f, pole: e.target.value })} required
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2">
                <option value="">— Choisir —</option>
                {DEFAULT_POLES.map((p) => <option key={p}>{p}</option>)}
                <option>Secrétariat de Direction</option>
              </select>
            </label>
            {champ("telephone", "Téléphone", "tel", "tel")}
            {champ("email", "E-mail (identifiant de connexion)", "email", "email")}
            {champ("motDePasse", `Mot de passe (${MOT_DE_PASSE_MIN} caractères min., lettres et chiffres)`, "password", "new-password")}
            <label className="block text-sm">
              <span className="font-semibold text-foreground">Confirmer le mot de passe</span>
              <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" />
            </label>
            {msg && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{msg}</p>}
            <button disabled={busy} className="w-full rounded-md bg-uk-green px-4 py-2.5 font-semibold text-white disabled:opacity-50">
              {busy ? "Création…" : "Créer mon compte"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
