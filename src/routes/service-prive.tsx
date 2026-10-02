import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  FileSignature,
  FileText,
  Layers,
  Lock,
  LogOut,
  Plus,
  Search,
  X,
} from "lucide-react";
import ukEmblem from "@/assets/uk-emblem.png";
import { supabase } from "@/lib/supabase";
import { ConventionDrawer, envoyerPdf, logHistorique } from "@/components/dcop/ConventionDrawer";
import {
  CADRES_PAR_POLE,
  DEFAULT_POLES,
  SEUIL_ALERTE_JOURS,
  STATUT_INFO,
  calculerEcheance,
  calculerStatut,
  formatDate,
  jouerSignalAlerte,
  joursRestants,
  type Convention,
  type Statut,
} from "@/lib/conventions";

export const Route = createFileRoute("/service-prive")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Service Privé — DCOP | Université de Kara" },
      {
        name: "description",
        content:
          "Espace privé de la DCOP de l'Université de Kara : veille et alertes sur les conventions et partenariats.",
      },
      { property: "og:title", content: "Service Privé — DCOP | Université de Kara" },
      {
        property: "og:description",
        content: "Espace réservé au personnel de la DCOP de l'Université de Kara.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ServicePrivePage,
});

function ServicePrivePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="min-h-screen bg-uk-blue" />;
  return session ? <Espace email={session.user.email ?? ""} /> : <Login />;
}

/* ---------------- Connexion ---------------- */

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError("Identifiants incorrects ou compte inexistant.");
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-uk-royal via-uk-blue to-uk-navy px-4 py-16 font-body">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-card p-8 shadow-xl sm:p-10">
        <img src={ukEmblem} alt="Université de Kara" className="mx-auto h-16 w-auto" />
        <span className="mx-auto mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-uk-blue/10">
          <Lock className="h-6 w-6 text-uk-blue" />
        </span>
        <h1 className="mt-4 text-center text-xl font-bold text-uk-blue">Espace Privé — DCOP</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Réservé au Directeur et au personnel de la DCOP.
        </p>
        <label className="mt-6 block text-sm font-medium text-foreground">Adresse email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
          autoComplete="email"
        />
        <label className="mt-4 block text-sm font-medium text-foreground">Mot de passe</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
          autoComplete="current-password"
        />
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <button
          disabled={busy}
          className="mt-6 w-full rounded-md bg-uk-blue py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Connexion…" : "Se connecter"}
        </button>
        <Link
          to="/"
          className="mt-4 flex items-center justify-center gap-1 text-sm text-uk-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Retour au Service Public
        </Link>
      </form>
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-uk-blue focus:ring-2 focus:ring-uk-blue/20";

/* ---------------- Espace privé ---------------- */

function Espace({ email }: { email: string }) {
  const [conventions, setConventions] = useState<Convention[]>([]);
  const [poles, setPoles] = useState<string[]>(DEFAULT_POLES);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Convention | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [alertNotice, setAlertNotice] = useState<number | null>(null);
  const alertChecked = useRef(false);
  const [q, setQ] = useState("");
  const [fPole, setFPole] = useState("");
  const [fStatut, setFStatut] = useState<"" | Statut>("");

  async function load() {
    setLoading(true);
    const [c, p] = await Promise.all([
      supabase.from("conventions").select("*"),
      supabase.from("poles").select("nom").order("created_at"),
    ]);
    if (c.error) setLoadError("Impossible de charger le registre. Vérifiez que les tables ont bien été créées.");
    else {
      setLoadError(null);
      const list = (c.data ?? []) as Convention[];
      setConventions(list);
      if (!alertChecked.current) {
        alertChecked.current = true;
        const n = list.filter((x) => !x.archived && joursRestants(x.date_echeance) >= 0 && joursRestants(x.date_echeance) <= SEUIL_ALERTE_JOURS).length;
        if (n > 0) {
          setAlertNotice(n);
          jouerSignalAlerte();
          setTimeout(() => setAlertNotice(null), 10000);
        }
      }
    }
    if (!p.error && p.data?.length) {
      setPoles(Array.from(new Set([...DEFAULT_POLES, ...p.data.map((r) => r.nom as string)])));
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const actives = useMemo(() => conventions.filter((c) => !c.archived), [conventions]);
  const selected = conventions.find((c) => c.id === selectedId) ?? null;

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return conventions
      .filter((c) => (showArchived ? c.archived : !c.archived))
      .map((c) => ({ ...c, statut: calculerStatut(c.date_echeance), jours: joursRestants(c.date_echeance) }))
      .filter((c) => !fPole || c.pole === fPole)
      .filter((c) => !fStatut || c.statut === fStatut)
      .filter(
        (c) =>
          !term ||
          [c.partenaire_nom, c.partenaire_pays, c.partenaire_ville, c.thematique, c.cadre_juridique]
            .join(" ")
            .toLowerCase()
            .includes(term),
      )
      .sort((a, b) => {
        // Les expirés en fin de liste, sinon échéance la plus proche d'abord
        const ea = a.jours < 0 ? 1 : 0;
        const eb = b.jours < 0 ? 1 : 0;
        return ea - eb || a.jours - b.jours;
      });
  }, [conventions, q, fPole, fStatut, showArchived]);

  const stats = useMemo(() => {
    const s = actives.map((c) => calculerStatut(c.date_echeance));
    const parPole = poles.map((p) => ({ pole: p, n: actives.filter((c) => c.pole === p).length }));
    return {
      total: actives.length,
      alerte: s.filter((x) => x === "alerte" || x === "urgence").length,
      urgence: s.filter((x) => x === "urgence").length,
      expire: s.filter((x) => x === "expire").length,
      parPole,
    };
  }, [actives, poles]);

  return (
    <div className="min-h-screen bg-muted font-body">
      <header className="bg-uk-blue text-primary-foreground shadow">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-card">
              <img src={ukEmblem} alt="Université de Kara" className="h-10 w-auto" />
            </span>
            <div>
              <p className="font-display text-xl font-bold">Espace Privé DCOP</p>
              <p className="text-xs opacity-80">Veille & alertes — Conventions et partenariats</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/" className="hidden opacity-90 hover:underline sm:inline">
              Service Public
            </Link>
            <span className="hidden opacity-80 md:inline">{email}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="inline-flex items-center gap-1.5 rounded-md bg-uk-gold px-3 py-1.5 font-semibold text-uk-navy hover:brightness-105"
            >
              <LogOut className="h-4 w-4" /> Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        {/* Cockpit */}
        <section>
          <h2 className="mb-4 text-lg font-bold text-uk-blue">Cockpit de synthèse</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi icon={FileSignature} label="Total des accords" value={stats.total} tone="text-uk-blue" />
            <Kpi icon={AlertTriangle} label="En alerte (≤ 5 mois)" value={stats.alerte} tone="text-uk-orange" />
            <Kpi icon={AlertTriangle} label="Urgence (< 2 mois)" value={stats.urgence} tone="text-destructive" />
            <Kpi icon={Layers} label="Expirés" value={stats.expire} tone="text-muted-foreground" />
          </div>
          <div className="mt-4 rounded-xl bg-card p-5 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-foreground">Répartition par pôle</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {stats.parPole.map(({ pole, n }) => (
                <div key={pole} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                  <span className="text-sm text-foreground/80">{pole}</span>
                  <span className="text-lg font-bold text-uk-blue">{n}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Registre */}
        <section className="rounded-xl bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-uk-blue">
              {showArchived ? "Conventions clôturées / archivées" : "Registre des conventions"}
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                Voir les archives
              </label>
              <button
                onClick={() => {
                  setEditing(null);
                  setShowForm(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-uk-green px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
              >
                <Plus className="h-4 w-4" /> Nouvelle convention
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un partenaire, pays, thématique…"
                className={inputCls + " mt-0 pl-9"}
              />
            </div>
            <select value={fPole} onChange={(e) => setFPole(e.target.value)} className={inputCls + " mt-0"}>
              <option value="">Tous les pôles</option>
              {poles.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select
              value={fStatut}
              onChange={(e) => setFStatut(e.target.value as "" | Statut)}
              className={inputCls + " mt-0"}
            >
              <option value="">Tous les statuts</option>
              {(Object.keys(STATUT_INFO) as Statut[]).map((s) => (
                <option key={s} value={s}>
                  {STATUT_INFO[s].label}
                </option>
              ))}
            </select>
          </div>

          {loadError && <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{loadError}</p>}

          <p className="mt-3 text-xs text-muted-foreground">Cliquez sur une ligne pour ouvrir la fiche détaillée.</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-uk-blue text-primary-foreground">
                <tr>
                  {["Statut", "Partenaire", "Pôle / Cadre", "Thématique", "Signature", "Échéance", "Jours restants", "Préavis"].map((h) => (
                    <th key={h} className="px-3 py-2.5 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      Chargement…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      Aucune convention à afficher.
                    </td>
                  </tr>
                ) : (
                  rows.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      onKeyDown={(e) => e.key === "Enter" && setSelectedId(c.id)}
                      tabIndex={0}
                      className="cursor-pointer border-b border-border align-top hover:bg-muted focus:bg-muted focus:outline-none"
                    >
                      <td className="px-3 py-3">
                        <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STATUT_INFO[c.statut].className}`}>
                          {STATUT_INFO[c.statut].label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="flex items-center gap-1.5 font-semibold text-foreground">
                          {c.partenaire_nom}
                          {c.pdf_path && <FileText className="h-3.5 w-3.5 text-uk-blue" aria-label="PDF joint" />}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[c.partenaire_ville, c.partenaire_pays].filter(Boolean).join(", ")}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <p>{c.pole}</p>
                        <p className="text-xs text-muted-foreground">{c.cadre_juridique}</p>
                      </td>
                      <td className="px-3 py-3">{c.thematique || "—"}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{formatDate(c.date_signature)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{formatDate(c.date_echeance)}</td>
                      <td className="px-3 py-3 font-semibold">{c.jours < 0 ? "Échue" : `J-${c.jours}`}</td>
                      <td className="px-3 py-3 text-xs">
                        {c.preavis_mois} mois
                        <br />
                        <span className="text-muted-foreground">Reconduction {c.reconduction.toLowerCase()}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {selected && (
        <ConventionDrawer
          convention={selected}
          onClose={() => setSelectedId(null)}
          onChanged={load}
          onEdit={() => {
            setEditing(selected);
            setShowForm(true);
          }}
        />
      )}

      {showForm && (
        <ConventionForm
          poles={poles}
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            setEditing(null);
            load();
          }}
        />
      )}

      {alertNotice !== null && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border-l-4 border-uk-orange bg-card p-4 shadow-xl"
        >
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-uk-orange" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">Veille des échéances</p>
            <p className="text-muted-foreground">
              {alertNotice} convention{alertNotice > 1 ? "s arrivent" : " arrive"} à échéance dans moins de 5 mois.
            </p>
            <button
              onClick={() => {
                setFStatut("");
                setShowArchived(false);
                setAlertNotice(null);
              }}
              className="mt-1 text-xs font-semibold text-uk-blue hover:underline"
            >
              Voir le registre
            </button>
          </div>
          <button onClick={() => setAlertNotice(null)} aria-label="Fermer" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Layers;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-xl bg-card p-5 shadow-sm">
      <Icon className={`h-5 w-5 ${tone}`} />
      <p className={`mt-3 text-3xl font-extrabold ${tone}`}>{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/* ---------------- Formulaire (entonnoir) ---------------- */

function ConventionForm({
  poles,
  initial,
  onClose,
  onSaved,
}: {
  poles: string[];
  initial?: Convention | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initCadres = initial ? (CADRES_PAR_POLE[initial.pole] ?? []) : [];
  const initCadreConnu = !!initial && initCadres.includes(initial.cadre_juridique);
  const [pole, setPole] = useState(initial?.pole ?? "");
  const [nouveauPole, setNouveauPole] = useState("");
  const [cadre, setCadre] = useState(initial ? (initCadreConnu ? initial.cadre_juridique : "__libre") : "");
  const [cadreLibre, setCadreLibre] = useState(initial && !initCadreConnu ? initial.cadre_juridique : "");
  const [nom, setNom] = useState(initial?.partenaire_nom ?? "");
  const [pays, setPays] = useState(initial?.partenaire_pays ?? "");
  const [ville, setVille] = useState(initial?.partenaire_ville ?? "");
  const [thematique, setThematique] = useState(initial?.thematique ?? "");
  const [signature, setSignature] = useState(initial?.date_signature ?? "");
  const [duree, setDuree] = useState(initial?.duree_mois ?? 60);
  const [preavis, setPreavis] = useState(initial?.preavis_mois ?? 3);
  const [reconduction, setReconduction] = useState(initial?.reconduction ?? "Expresse");
  const [pdf, setPdf] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const poleFinal = pole === "__new" ? nouveauPole.trim() : pole;
  const cadres = CADRES_PAR_POLE[poleFinal] ?? [];
  const cadreFinal = cadre === "__libre" || cadres.length === 0 ? cadreLibre.trim() : cadre;
  const echeance = calculerEcheance(signature, duree);
  const statut = echeance ? calculerStatut(echeance) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!poleFinal || !cadreFinal) {
      setError("Veuillez renseigner le pôle et le cadre juridique.");
      return;
    }
    if (pdf && (pdf.type !== "application/pdf" || pdf.size > 20 * 1024 * 1024)) {
      setError("Le document doit être un PDF de 20 Mo maximum.");
      return;
    }
    setBusy(true);
    setError(null);
    if (pole === "__new") {
      await supabase.from("poles").insert({ nom: poleFinal });
    }
    const payload = {
      pole: poleFinal,
      cadre_juridique: cadreFinal,
      partenaire_nom: nom.trim(),
      partenaire_pays: pays.trim(),
      partenaire_ville: ville.trim() || null,
      thematique: thematique.trim() || null,
      date_signature: signature,
      duree_mois: duree,
      date_echeance: echeance,
      preavis_mois: preavis,
      reconduction,
    };
    const res = initial
      ? await supabase.from("conventions").update(payload).eq("id", initial.id).select("id").single()
      : await supabase.from("conventions").insert(payload).select("id").single();
    if (res.error || !res.data) {
      setBusy(false);
      setError("Enregistrement impossible : " + (res.error?.message ?? "erreur inconnue"));
      return;
    }
    const id = res.data.id as string;
    await logHistorique(id, initial ? "Convention modifiée" : "Convention enregistrée");
    if (pdf) {
      const err = await envoyerPdf(id, pdf);
      if (err) {
        setBusy(false);
        setError(err);
        return;
      }
    }
    setBusy(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/50 p-4 sm:py-10">
      <form onSubmit={submit} className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-2xl sm:p-8">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-uk-blue">{initial ? "Modifier la convention" : "Nouvelle convention"}</h3>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <Step n={1} title="Pôle opérationnel">
          <select required value={pole} onChange={(e) => { setPole(e.target.value); setCadre(""); }} className={inputCls}>
            <option value="">— Choisir un pôle —</option>
            {poles.map((p) => (
              <option key={p}>{p}</option>
            ))}
            <option value="__new">+ Ajouter un nouveau pôle</option>
          </select>
          {pole === "__new" && (
            <input required placeholder="Nom du nouveau pôle" value={nouveauPole} onChange={(e) => setNouveauPole(e.target.value)} className={inputCls} />
          )}
        </Step>

        {poleFinal && (
          <Step n={2} title="Cadre juridique / type d'accord">
            {cadres.length > 0 && (
              <select required value={cadre} onChange={(e) => setCadre(e.target.value)} className={inputCls}>
                <option value="">— Choisir un type d'accord —</option>
                {cadres.map((c) => (
                  <option key={c}>{c}</option>
                ))}
                <option value="__libre">Autre (saisie libre)</option>
              </select>
            )}
            {(cadre === "__libre" || cadres.length === 0) && (
              <input required placeholder="Préciser le type d'accord" value={cadreLibre} onChange={(e) => setCadreLibre(e.target.value)} className={inputCls} />
            )}
          </Step>
        )}

        {cadreFinal && (
          <Step n={3} title="Informations contractuelles">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Partenaire contractant *" className="sm:col-span-3">
                <input required value={nom} onChange={(e) => setNom(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Pays *">
                <input required value={pays} onChange={(e) => setPays(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Ville" className="sm:col-span-2">
                <input value={ville} onChange={(e) => setVille(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Thématique / domaine d'intervention" className="sm:col-span-3">
                <input value={thematique} onChange={(e) => setThematique(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Date de signature *">
                <input type="date" required value={signature} onChange={(e) => setSignature(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Durée (mois) *">
                <input type="number" min={1} required value={duree} onChange={(e) => setDuree(Number(e.target.value))} className={inputCls} />
              </Field>
              <Field label="Date d'échéance (calculée)">
                <input readOnly value={echeance ? formatDate(echeance) : "—"} className={inputCls + " bg-muted"} />
              </Field>
              <Field label="Préavis de dénonciation (mois)">
                <input type="number" min={0} value={preavis} onChange={(e) => setPreavis(Number(e.target.value))} className={inputCls} />
              </Field>
              <Field label="Reconduction" className="sm:col-span-2">
                <select value={reconduction} onChange={(e) => setReconduction(e.target.value)} className={inputCls}>
                  <option>Expresse</option>
                  <option>Tacite</option>
                  <option>Non reconductible</option>
                </select>
              </Field>
              <Field label={initial?.pdf_path ? "Remplacer le PDF officiel scanné" : "Document PDF officiel scanné (optionnel)"} className="sm:col-span-3">
                <input type="file" accept="application/pdf" onChange={(e) => setPdf(e.target.files?.[0] ?? null)} className={inputCls} />
              </Field>
            </div>
            {statut && (
              <p className="mt-3 text-sm">
                Statut calculé :{" "}
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUT_INFO[statut].className}`}>
                  {STATUT_INFO[statut].label}
                </span>
              </p>
            )}
          </Step>
        )}

        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">
            Annuler
          </button>
          <button disabled={busy || !cadreFinal} className="rounded-md bg-uk-blue px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-uk-gold text-xs font-bold text-uk-navy">{n}</span>
        {title}
      </p>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block text-xs font-medium text-muted-foreground ${className}`}>
      {label}
      {children}
    </label>
  );
}
