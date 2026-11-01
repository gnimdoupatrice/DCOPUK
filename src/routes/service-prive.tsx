import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CriticalAlarm } from "@/components/dcop/CriticalAlarm";
import { RegulariserAlerte } from "@/components/dcop/RegulariserAlerte";
import { InstallPwa } from "@/components/dcop/InstallPwa";
import type { Session } from "@supabase/supabase-js";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  Bell,
  Briefcase,
  Download,
  Eye,
  FileSignature,
  FileText,
  Layers,
  Lock,
  LogOut,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import ukEmblem from "@/assets/uk-emblem.png";
import { supabase } from "@/lib/supabase";
import { ConventionDrawer, envoyerPdf, logHistorique } from "@/components/dcop/ConventionDrawer";
import { EmailsAlerteInput } from "@/components/dcop/EmailsAlerteInput";
import { PointsFocauxEditor } from "@/components/dcop/PointsFocauxEditor";
import { ProjetsEditor } from "@/components/dcop/ProjetsEditor";
import {
  LIMITES_REBOURS,
  REBOURS_VIDE,
  bornesAlerte,
  controlerDateAlerte,
  dateDepuisRebours,
  formatMontant,
  reboursEstVide,
  resumerProjets,
  validerPointFocal,
  validerProjet,
  type PointFocalSaisie,
  type ProjetSaisie,
  type Rebours,
} from "@/lib/projets";
import {
  CADRES_PAR_POLE,
  DEFAULT_POLES,
  etatAlerte,
  SOUS_MENTION_ALERTE,
  STATUT_INFO,
  calculerEcheance,
  calculerStatut,
  statutConvention,
  momentAlerteConvention,
  sasModification,
  finFenetreCorrection,
  dureeDetaillee,
  libelleDureeDetaillee,
  decalerDate,
  droitModification,
  type SasModification,
  dateLimitePreavis,
  dureeEntreMois,
  formatDate,
  libelleAlarme,
  joursRestants,
  moisVersJours,
  retirerMois,
  type Convention,
  type Statut,
  correspondCockpit,
  type FiltreCockpit,
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
    else sessionStorage.setItem("dcop_login_explicite", "1");
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
  const [infoCreation, setInfoCreation] = useState<InfoCreation | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resumeProjets, setResumeProjets] = useState<Map<string, { count: number; totalFcfa: number }>>(new Map());
  const [showArchived, setShowArchived] = useState(false);
  const [q, setQ] = useState("");
  const [fPole, setFPole] = useState("");
  const [fStatut, setFStatut] = useState<"" | Statut>("");
  const [fCockpit, setFCockpit] = useState<FiltreCockpit>("");
  const registreRef = useRef<HTMLElement | null>(null);
  function filtrerCockpit(f: FiltreCockpit) {
    setFCockpit(f);
    setFStatut("");
    if (f) setShowArchived(false);
    registreRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Tri interactif des colonnes
  type SortField = "partenaire_nom" | "pole" | "date_signature" | "date_echeance" | "jours" | "statut";
  const [sortKey, setSortKey] = useState<SortField>("jours");
  const [sortAsc, setSortAsc] = useState(true);

  const [alarmeActiveId, setAlarmeActiveId] = useState<string | null>(null);
  const [resumeConnexion, setResumeConnexion] = useState(false);
  const [regulariserId, setRegulariserId] = useState<string | null>(null);
  const resumeStats = useMemo(() => {
    const actives = conventions.filter((c) => !c.archived);
    return {
      enVigueur: actives.filter((c) => correspondCockpit(c, "actives")).length,
      depassee: actives.filter((c) => correspondCockpit(c, "depassee")).length,
      reportee: actives.filter((c) => correspondCockpit(c, "reportee")).length,
      arretee: actives.filter((c) => correspondCockpit(c, "arretee")).length,
      expire: actives.filter((c) => correspondCockpit(c, "expire")).length,
    };
  }, [conventions]);

  function handleSort(key: SortField) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  async function load() {
    setLoading(true);
    const [c, p, pj] = await Promise.all([
      supabase.from("conventions").select("*"),
      supabase.from("poles").select("nom").order("created_at"),
      supabase.from("convention_projets").select("convention_id, budget_montant, budget_devise"),
    ]);
    if (!pj.error) setResumeProjets(resumerProjets((pj.data ?? []) as Parameters<typeof resumerProjets>[0]));
    if (c.error) setLoadError("Impossible de charger le registre. Vérifiez que les tables ont bien été créées.");
    else {
      setLoadError(null);
      const list = (c.data ?? []) as Convention[];
      setConventions(list);
      // Résumé uniquement après une saisie explicite des identifiants
      if (sessionStorage.getItem("dcop_login_explicite") === "1") {
        sessionStorage.removeItem("dcop_login_explicite");
        setResumeConnexion(true);
      }
    }
    // Pôles : valeurs par défaut + table des pôles + pôles déjà utilisés dans le registre
    setPoles(
      Array.from(
        new Set([
          ...DEFAULT_POLES,
          ...(!p.error && p.data ? p.data.map((r) => r.nom as string) : []),
          ...((c.data ?? []) as Convention[]).map((x) => x.pole).filter(Boolean),
        ]),
      ),
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
    async function rafraichir() {
      // Sur mobile, l'onglet peut s'endormir : on revalide la session avant de relire
      await supabase.auth.getSession();
      const { data, error } = await supabase.from("conventions").select("*");
      if (!error && data) {
        setConventions(data as Convention[]);
        setLoadError(null);
      }
    }
    const id = window.setInterval(rafraichir, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") rafraichir();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", rafraichir);
    window.addEventListener("pageshow", rafraichir);
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") rafraichir();
    });
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", rafraichir);
      window.removeEventListener("pageshow", rafraichir);
      sub.subscription.unsubscribe();
    };
  }, []);

  const actives = useMemo(() => conventions.filter((c) => !c.archived), [conventions]);
  const selected = conventions.find((c) => c.id === selectedId) ?? null;

  async function supprimerDirect(id: string, nom: string, pdfPath?: string | null) {
    const saisie = window.prompt(
      `Suppression définitive de la convention avec « ${nom} » et de son document PDF.\nCette action est irréversible.\n\nPour confirmer, tapez le nom du partenaire : ${nom}`,
    );
    if (saisie === null) return;
    if (saisie.trim().toLowerCase() !== nom.trim().toLowerCase()) {
      alert("Nom du partenaire incorrect : la suppression a été annulée.");
      return;
    }
    try {
      await supabase.from("convention_historique").delete().eq("convention_id", id);
      await supabase.from("convention_points_focaux").delete().eq("convention_id", id);
      await supabase.from("convention_projets").delete().eq("convention_id", id);
      if (pdfPath) {
        await supabase.storage.from("conventions-pdf").remove([pdfPath]);
      }
      const { error } = await supabase.from("conventions").delete().eq("id", id);
      if (error) {
        alert("Erreur lors de la suppression : " + error.message);
      } else {
        if (selectedId === id) setSelectedId(null);
        await load();
      }
    } catch {
      alert("Erreur inattendue lors de la suppression.");
    }
  }

  async function ouvrirPdfDirect(path: string) {
    const { data, error } = await supabase.storage.from("conventions-pdf").createSignedUrl(path, 600);
    if (error || !data) {
      alert("Impossible d'ouvrir le document PDF.");
    } else {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  }

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = conventions
      .filter((c) => (showArchived ? c.archived : !c.archived))
      .map((c) => {
        const limPreavis = dateLimitePreavis(c.date_echeance, c.preavis_mois);
        const jPreavis = limPreavis ? joursRestants(limPreavis) : 999;
        return {
          ...c,
          statut: statutConvention(c),
          etat: etatAlerte(c),
          jours: joursRestants(c.date_echeance),
          date_limite_preavis: limPreavis,
          jours_avant_preavis: jPreavis,
        };
      })
      .filter((c) => !fPole || c.pole === fPole)
      .filter((c) => !fStatut || c.statut === fStatut)
      .filter((c) => correspondCockpit(c, fCockpit))
      .filter(
        (c) =>
          !term ||
          [c.partenaire_nom, c.partenaire_pays, c.partenaire_ville, c.thematique, c.cadre_juridique]
            .join(" ")
            .toLowerCase()
            .includes(term),
      );

    return list.sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (typeof va === "string") va = (va as string).toLowerCase();
      if (typeof vb === "string") vb = (vb as string).toLowerCase();
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [conventions, q, fPole, fStatut, fCockpit, showArchived, sortKey, sortAsc]);

  const stats = useMemo(() => {
    const parPole = poles.map((p) => ({ pole: p, n: actives.filter((c) => c.pole === p).length }));
    const n = (f: FiltreCockpit) => actives.filter((c) => correspondCockpit(c, f)).length;
    return {
      total: actives.length,
      enCours: n("actives"),
      depassee: n("depassee"),
      reportee: n("reportee"),
      arretee: n("arretee"),
      expire: n("expire"),
      parPole,
    };
  }, [actives, poles]);

  function exporterCsv() {
    if (rows.length === 0) {
      alert("Aucune convention à exporter.");
      return;
    }
    const headers = [
      "Partenaire",
      "Pôle",
      "Cadre juridique",
      "Thématique",
      "Pays",
      "Ville",
      "Date signature",
      "Durée (mois)",
      "Date échéance",
      "Jours restants",
      "Statut",
      "Préavis (mois)",
      "Reconduction",
      "Archivée",
      "Nombre de projets",
      "Budget total projets (FCFA)",
    ];

    const escapeCsv = (str: string | number | null | undefined) => {
      const val = str === null || str === undefined ? "" : String(str);
      return `"${val.replace(/"/g, '""')}"`;
    };

    const lines = rows.map((c) =>
      [
        escapeCsv(c.partenaire_nom),
        escapeCsv(c.pole),
        escapeCsv(c.cadre_juridique),
        escapeCsv(c.thematique || ""),
        escapeCsv(c.partenaire_pays),
        escapeCsv(c.partenaire_ville || ""),
        escapeCsv(formatDate(c.date_signature)),
        escapeCsv(c.duree_mois),
        escapeCsv(formatDate(c.date_echeance)),
        escapeCsv(c.jours),
        escapeCsv(STATUT_INFO[c.statut].label),
        escapeCsv(c.preavis_mois),
        escapeCsv(c.reconduction),
        escapeCsv(c.archived ? "Oui" : "Non"),
        escapeCsv(resumeProjets.get(c.id)?.count ?? 0),
        escapeCsv(resumeProjets.get(c.id)?.totalFcfa ?? 0),
      ].join(";")
    );

    // BOM UTF-8 pour préserver les accents dans Excel
    const csvContent = "\uFEFF" + [headers.join(";"), ...lines].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conventions_dcop_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-muted font-body">
      <header className="bg-uk-blue text-primary-foreground shadow">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card p-1.5">
              <img src={ukEmblem} alt="Université de Kara" className="h-full w-full object-contain" />
            </span>
            <div>
              <p className="font-display text-xl font-bold">Espace Privé DCOP</p>
              <p className="text-xs opacity-80">Veille & alertes — Conventions et partenariats</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm sm:gap-3">
            <Link to="/" className="inline-flex items-center gap-1 rounded-md border border-primary-foreground/40 px-2.5 py-1.5 font-semibold hover:bg-primary-foreground/10" title="Retour au Service Public">
              ← <span className="sm:hidden">Public</span><span className="hidden sm:inline">Service Public</span>
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
          <div className="flex flex-wrap justify-center gap-4">
            <Kpi loading={loading} icon={FileSignature} label="Total des accords" value={stats.total} tone="text-uk-blue" active={fCockpit === ""} onClick={() => filtrerCockpit("")} />
            <Kpi loading={loading} icon={FileSignature} label="En vigueur" value={stats.enCours} tone="text-uk-green" active={fCockpit === "actives"} onClick={() => filtrerCockpit("actives")} />
            <Kpi loading={loading} icon={AlertTriangle} label="Alertes reportées" value={stats.reportee} tone="text-uk-orange" active={fCockpit === "reportee"} onClick={() => filtrerCockpit("reportee")} />
            <Kpi loading={loading} icon={Layers} label="Alertes arrêtées définitivement" value={stats.arretee} tone="text-uk-blue" active={fCockpit === "arretee"} onClick={() => filtrerCockpit("arretee")} />
            <Kpi loading={loading} icon={Layers} label="Expirées" value={stats.expire} tone="text-muted-foreground" active={fCockpit === "expire"} onClick={() => filtrerCockpit("expire")} />
          </div>
          <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="mb-3 text-center text-sm font-semibold text-foreground">Répartition par pôle</p>
            <div className="flex flex-wrap justify-center gap-3">
              {stats.parPole.map(({ pole, n }) => (
                <div key={pole} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 sm:w-[260px]">
                  <span className="min-w-0 text-sm text-foreground/80">{pole}</span>
                  <span className="shrink-0 text-lg font-bold text-uk-blue">{loading ? "…" : n}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Registre */}
        <section ref={registreRef} className="scroll-mt-4 rounded-xl bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-uk-blue">
              {showArchived ? "Conventions clôturées / archivées" : "Registre des conventions"}
            </h2>
            <div className="flex flex-wrap items-center gap-2">


              <button
                type="button"
                onClick={exporterCsv}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                <Download className="h-4 w-4 text-uk-blue" />
                <span>Export CSV / Excel</span>
              </button>

              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                Archives
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

          {fCockpit && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-uk-blue/30 bg-uk-blue/10 px-3 py-2 text-sm text-uk-blue">
              <span>
                Filtre du cockpit :{" "}
                <strong>
                  {{ actives: "En vigueur", depassee: "En vigueur", reportee: "Alertes reportées", arretee: "Alertes arrêtées définitivement", expire: "Expirées" }[fCockpit]}
                </strong>
              </span>
              <button onClick={() => setFCockpit("")} className="ml-auto rounded-md bg-uk-blue px-3 py-1 text-xs font-semibold text-primary-foreground hover:brightness-110">
                Réinitialiser le filtre
              </button>
            </div>
          )}

          {loadError && <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{loadError}</p>}

          <p className="mt-3 text-xs text-muted-foreground">Cliquez sur une ligne pour ouvrir la fiche détaillée.</p>
          <div className="mt-2 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[1150px] text-left text-sm">
              <thead className="border-b-2 border-uk-gold bg-uk-blue text-xs uppercase tracking-wide text-primary-foreground">
                <tr>
                  <th onClick={() => handleSort("statut")} className="cursor-pointer px-3 py-2.5 font-semibold hover:bg-uk-navy">
                    <span className="inline-flex items-center gap-1">
                      Statut {sortKey === "statut" ? (sortAsc ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />}
                    </span>
                  </th>
                  <th onClick={() => handleSort("partenaire_nom")} className="cursor-pointer px-3 py-2.5 font-semibold hover:bg-uk-navy">
                    <span className="inline-flex items-center gap-1">
                      Partenaire {sortKey === "partenaire_nom" ? (sortAsc ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />}
                    </span>
                  </th>
                  <th onClick={() => handleSort("pole")} className="cursor-pointer px-3 py-2.5 font-semibold hover:bg-uk-navy">
                    <span className="inline-flex items-center gap-1">
                      Pôle / Cadre {sortKey === "pole" ? (sortAsc ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />}
                    </span>
                  </th>
                  <th className="px-3 py-2.5 font-semibold">Thématique</th>
                  <th onClick={() => handleSort("date_signature")} className="cursor-pointer px-3 py-2.5 font-semibold hover:bg-uk-navy">
                    <span className="inline-flex items-center gap-1">
                      Signature {sortKey === "date_signature" ? (sortAsc ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />}
                    </span>
                  </th>
                  <th onClick={() => handleSort("date_echeance")} className="cursor-pointer px-3 py-2.5 font-semibold hover:bg-uk-navy">
                    <span className="inline-flex items-center gap-1">
                      Échéance {sortKey === "date_echeance" ? (sortAsc ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />}
                    </span>
                  </th>
                  <th onClick={() => handleSort("jours")} className="cursor-pointer px-3 py-2.5 font-semibold hover:bg-uk-navy">
                    <span className="inline-flex items-center gap-1">
                      Jours restants {sortKey === "jours" ? (sortAsc ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />}
                    </span>
                  </th>
                  <th className="px-4 py-3 font-semibold">Préavis & Alerte</th>
                  <th className="px-4 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                      Chargement…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
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
                      className={`cursor-pointer border-b border-border align-middle transition-colors odd:bg-card even:bg-muted/40 hover:bg-uk-blue/5 focus:bg-uk-blue/5 focus:outline-none ${
                        alarmeActiveId === c.id ? "animate-pulse bg-destructive/10 ring-2 ring-inset ring-destructive/50" : ""
                      }`}
                    >
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STATUT_INFO[c.statut].className}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {STATUT_INFO[c.statut].label}
                        </span>
                        {c.statut === "actif" && SOUS_MENTION_ALERTE[c.etat] && (
                          <p className={`mt-1.5 text-[11px] font-semibold ${SOUS_MENTION_ALERTE[c.etat]!.cls}`}>
                            {SOUS_MENTION_ALERTE[c.etat]!.label}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <p className="flex items-center gap-1.5 font-semibold text-foreground">
                          {c.partenaire_nom}
                          {c.pdf_path && <FileText className="h-3.5 w-3.5 shrink-0 text-uk-blue" aria-label="PDF joint" />}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[c.partenaire_ville, c.partenaire_pays].filter(Boolean).join(", ")}
                        </p>
                        {(() => {
                          const rp = resumeProjets.get(c.id);
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(c.id);
                              }}
                              title={rp ? "Voir les projets" : "Ajouter un projet"}
                              className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${rp ? "bg-uk-green/15 text-uk-green hover:bg-uk-green/25" : "border border-dashed border-border text-muted-foreground hover:border-uk-blue hover:text-uk-blue"}`}
                            >
                              <Briefcase className="h-3 w-3" />
                              {rp ? `${rp.count} projet${rp.count > 1 ? "s" : ""} · ${formatMontant(rp.totalFcfa)}` : "+ Projet"}
                            </button>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-foreground">{c.pole}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{c.cadre_juridique}</p>
                      </td>
                      <td className="px-4 py-4 text-foreground/80">{c.thematique || "—"}</td>
                      <td className="px-4 py-4 whitespace-nowrap tabular-nums">{formatDate(c.date_signature)}</td>
                      <td className="px-4 py-4 whitespace-nowrap tabular-nums">{formatDate(c.date_echeance)}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-block rounded-md px-2 py-1 text-xs font-bold tabular-nums ${c.jours < 0 ? "bg-muted text-muted-foreground" : c.jours <= 60 ? "bg-uk-orange/15 text-uk-orange" : "bg-uk-blue/10 text-uk-blue"}`}>
                          {c.jours < 0 ? "Échue" : `J-${c.jours}`}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs">
                        <div className="space-y-1.5">
                          <div className="rounded-lg border border-border bg-background px-2.5 py-1.5">
                            <p className="font-semibold text-foreground">{c.preavis_mois == null ? "Sans préavis" : `Préavis : ${c.preavis_mois} mois`}</p>
                            <p className="text-muted-foreground">Reconduction {c.reconduction.toLowerCase()}</p>
                            {c.jours_avant_preavis <= 60 && c.jours_avant_preavis >= 0 && (
                              <span className="mt-1 inline-block rounded bg-uk-orange/15 px-1.5 py-0.5 font-bold text-uk-orange">
                                Préavis dans {c.jours_avant_preavis}j !
                              </span>
                            )}
                            {c.jours_avant_preavis < 0 && c.jours > 0 && (
                              <span className="mt-1 inline-block rounded bg-destructive/15 px-1.5 py-0.5 font-bold text-destructive">
                                Délai préavis dépassé
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 rounded-lg bg-uk-blue/10 px-2.5 py-1.5 font-medium text-uk-blue">
                            <Bell className="h-3.5 w-3.5 shrink-0" />
                            <span>{libelleAlarme(c)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(c.id)}
                            title="Fiche détaillée et avenant"
                            className="inline-flex items-center gap-1 rounded-md bg-uk-blue/10 px-2.5 py-1.5 text-xs font-semibold text-uk-blue transition hover:bg-uk-blue hover:text-primary-foreground"
                          >
                            <Eye className="h-3.5 w-3.5" /> Détails
                          </button>
                          <button
                            type="button"
                            disabled={!droitModification(c).ok}
                            onClick={() => {
                              setEditing(c);
                              setShowForm(true);
                            }}
                            title={droitModification(c).raison}
                            className="inline-flex items-center gap-1 rounded-md bg-uk-gold/20 px-2.5 py-1.5 text-xs font-semibold text-uk-navy transition hover:bg-uk-gold disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-uk-gold/20"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Modifier
                          </button>
                          {c.pdf_path && (
                            <button
                              type="button"
                              onClick={() => ouvrirPdfDirect(c.pdf_path!)}
                              title="Ouvrir le document PDF"
                              aria-label="Ouvrir le PDF"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-uk-blue transition hover:bg-muted"
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => supprimerDirect(c.id, c.partenaire_nom, c.pdf_path)}
                            title="Supprimer la convention"
                            aria-label="Supprimer la convention"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
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
          onRegulariser={() => setRegulariserId(selected.id)}
          onEdit={() => {
            setEditing(selected);
            setShowForm(true);
          }}
        />
      )}

      {showForm && (
        <ConventionForm
          poles={poles}
          cadresParPole={cadresParPole(conventions)}
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={(info) => {
            setShowForm(false);
            if (info) setInfoCreation(info);
            setEditing(null);
            load();
          }}
        />
      )}

      <CriticalAlarm conventions={conventions} onRefresh={load} onActiveChange={setAlarmeActiveId} />
      {regulariserId && conventions.find((c) => c.id === regulariserId) && (
        <RegulariserAlerte
          convention={conventions.find((c) => c.id === regulariserId)!}
          onClose={() => setRegulariserId(null)}
          onDone={load}
        />
      )}
      {resumeConnexion && !alarmeActiveId && !actives.some((c) => etatAlerte(c) === "sonnerie") && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={() => setResumeConnexion(false)}>
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-heading text-lg font-bold text-uk-blue">Bienvenue — point de situation</h2>
            <p className="mt-1 text-xs text-muted-foreground">Synthèse du registre des conventions à votre connexion.</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex justify-between rounded-lg bg-emerald-100 px-3 py-2 font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"><span>Conventions en vigueur</span><span>{resumeStats.enVigueur}</span></li>
              <li className="flex justify-between rounded-lg bg-amber-100 px-3 py-2 font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"><span>Alertes reportées</span><span>{resumeStats.reportee}</span></li>
              <li className="flex justify-between rounded-lg bg-sky-100 px-3 py-2 font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"><span>Alertes arrêtées définitivement</span><span>{resumeStats.arretee}</span></li>
              <li className="flex justify-between rounded-lg bg-zinc-200 px-3 py-2 font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"><span>Conventions expirées</span><span>{resumeStats.expire}</span></li>
            </ul>
            <button type="button" onClick={() => setResumeConnexion(false)} className="mt-5 w-full rounded-lg bg-uk-blue px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110">J'ai compris</button>
          </div>
        </div>
      )}
      {infoCreation && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 p-4" onClick={() => setInfoCreation(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-heading text-lg font-bold text-uk-green">✓ Convention enregistrée avec succès</h2>
            <dl className="mt-3 space-y-1 text-sm">
              <div><dt className="inline font-semibold">Partenaire : </dt><dd className="inline">{infoCreation.nom}</dd></div>
              <div><dt className="inline font-semibold">Pôle : </dt><dd className="inline">{infoCreation.pole}</dd></div>
              <div><dt className="inline font-semibold">Échéance : </dt><dd className="inline">{formatDate(infoCreation.echeance)}</dd></div>
              <div><dt className="inline font-semibold">Alerte : </dt><dd className="inline">{infoCreation.alerte}</dd></div>
            </dl>
            <div className="mt-4 rounded-lg bg-emerald-100 p-3 text-sm text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
              <p className="font-semibold">⏱ Fenêtre de correction libre : 48 heures</p>
              <p>Jusqu'au {infoCreation.finCorrection.toLocaleString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}, vous pouvez corriger l'ensemble du formulaire.</p>
            </div>
            <div className="mt-3 rounded-lg bg-sky-100 p-3 text-sm text-sky-900 dark:bg-sky-950/60 dark:text-sky-200">
              <p className="font-semibold">Après 48 heures : dossier stabilisé</p>
              <p>Partenaire, pays, pôle, cadre juridique, dates, alerte et reconduction sont verrouillés. Seuls les éléments laissés vides aujourd'hui (PDF, ville, thématique, préavis) pourront être complétés, une seule fois. Toute prolongation passe par un Avenant.</p>
            </div>
            <div className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-semibold">Dès que l'alerte sonne : gel total</p>
              <p>Plus aucune modification, même des éléments optionnels. Seuls « Reporter » ou « Avenant » restent possibles.</p>
            </div>
            <button type="button" onClick={() => setInfoCreation(null)} className="mt-5 w-full rounded-lg bg-uk-blue px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">J'ai pris note</button>
          </div>
        </div>
      )}
      <InstallPwa />
    </div>
  );
}


function Kpi({
  icon: Icon,
  label,
  value,
  tone,
  active,
  loading,
  onClick,
}: {
  icon: typeof Layers;
  label: string;
  value: number;
  tone: string;
  active: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-[calc(50%-0.5rem)] rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:w-[220px] ${
        active ? "border-uk-blue ring-2 ring-uk-blue/30" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-3xl font-extrabold tracking-tight ${tone}`}>
          {loading ? <span className="inline-block h-8 w-10 animate-pulse rounded bg-muted" /> : value}
        </p>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon className={`h-4.5 w-4.5 ${tone}`} />
        </span>
      </div>
      <p className="mt-2 text-sm font-medium leading-snug text-muted-foreground">{label}</p>
    </button>
  );
}

/* ---------------- Formulaire (entonnoir) ---------------- */

type InfoCreation = { nom: string; pole: string; echeance: string; alerte: string; finCorrection: Date };
const lk = (l: boolean) => (l ? " cursor-not-allowed bg-muted opacity-70" : "");
const cad = (l: boolean) => (l ? " 🔒" : "");

function ConventionForm({
  poles,
  cadresParPole: modelesCadres,
  initial,
  onClose,
  onSaved,
}: {
  poles: string[];
  cadresParPole: Record<string, string[]>;
  initial?: Convention | null;
  onClose: () => void;
  onSaved: (info: InfoCreation | null) => void;
}) {
  const initCadres = initial ? (modelesCadres[initial.pole] ?? []) : [];
  const initCadreConnu = !!initial && initCadres.includes(initial.cadre_juridique);
  const [pole, setPole] = useState(initial?.pole ?? "");
  const [nouveauPole, setNouveauPole] = useState("");
  const [cadre, setCadre] = useState(initial ? (initCadreConnu ? initial.cadre_juridique : "__libre") : "");
  const [cadreLibre, setCadreLibre] = useState(initial && !initCadreConnu ? initial.cadre_juridique : "");
  const [nom, setNom] = useState(initial?.partenaire_nom ?? "");
  const [pays, setPays] = useState(initial?.partenaire_pays ?? "");
  const [ville, setVille] = useState(initial?.partenaire_ville ?? "");
  const [thematique, setThematique] = useState(initial?.thematique ?? "");

  // Dates et échéances
  const [signature, setSignature] = useState(initial?.date_signature ?? "");
  const [dateEcheance, setDateEcheance] = useState(initial?.date_echeance ?? "");

  // Paramétrage de l'alerte
  const [dateAlerte, setDateAlerte] = useState<string>(initial?.date_alerte ?? "");
  const [heureAlerte, setHeureAlerte] = useState<string>(initial?.heure_alerte ?? "");

  const [preavis, setPreavis] = useState<string>(initial?.preavis_mois != null ? String(initial.preavis_mois) : "");
  const [reconduction, setReconduction] = useState(initial?.reconduction ?? "Non reconductible");
  const [pdf, setPdf] = useState<File | null>(null);
  const [emailsAlerte, setEmailsAlerte] = useState<string[]>(initial?.emails_alerte ?? []);
  const [pointsFocaux, setPointsFocaux] = useState<PointFocalSaisie[]>([]);
  const [projets, setProjets] = useState<ProjetSaisie[]>([]);
  const [rebours, setRebours] = useState<Rebours>(REBOURS_VIDE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const poleFinal = pole === "__new" ? nouveauPole.trim() : pole;
  const cadres = modelesCadres[poleFinal] ?? [];
  const cadreFinal = cadre === "__libre" || cadres.length === 0 ? cadreLibre.trim() : cadre;

  // Sas de modification
  const sas: SasModification = initial ? sasModification(initial) : "libre";
  const stabilise = sas === "stabilise";
  const gele = sas === "gele";
  const lockCore = stabilise || gele;
  const lockVille = gele || (stabilise && !!initial?.partenaire_ville);
  const lockThem = gele || (stabilise && !!initial?.thematique);
  const lockPreavis = gele || (stabilise && initial?.preavis_mois != null);
  const lockPdf = gele || (!!initial?.pdf_path && sas !== "libre");
  const heuresRestantes = initial ? Math.max(0, Math.ceil((finFenetreCorrection(initial).getTime() - Date.now()) / 3600000)) : 48;

  const detail = dureeDetaillee(signature, dateEcheance);
  const dureeCalculee = signature && dateEcheance ? dureeEntreMois(signature, dateEcheance) : 0;
  const momentAlerte = dateAlerte && heureAlerte ? momentAlerteConvention({ date_alerte: dateAlerte, heure_alerte: heureAlerte } as Convention) : null;
  const statut = dateEcheance ? calculerStatut(dateEcheance, momentAlerte) : null;

  const initDet = initial ? dureeDetaillee(initial.date_signature, initial.date_echeance) : null;
  const [dureeAns, setDureeAns] = useState(initDet ? String(initDet.ans) : "");
  const [dureeMois, setDureeMois] = useState(initDet ? String(initDet.mois) : "");
  function appliquerDuree(a: string, m: string, sig = signature) {
    setDureeAns(a);
    setDureeMois(m);
    const total = Number(a || 0) * 12 + Number(m || 0);
    if (sig && total > 0) setDateEcheance(decalerDate(sig, total));
  }
  function saisirEcheance(v: string) {
    setDateEcheance(v);
    const d = dureeDetaillee(signature, v);
    if (d) {
      setDureeAns(String(Math.min(d.ans, 10)));
      setDureeMois(String(d.mois));
    }
  }

  const bornes = bornesAlerte(signature, dateEcheance);
  function appliquerRebours(r: Rebours) {
    setRebours(r);
    if (reboursEstVide(r) || !dateEcheance) return;
    setDateAlerte(dateDepuisRebours(dateEcheance, r));
    if (!heureAlerte) setHeureAlerte("08:00");
  }
  const reboursErreur = !reboursEstVide(rebours) && dateEcheance ? controlerDateAlerte(dateDepuisRebours(dateEcheance, rebours), signature, dateEcheance) : null;
  const alerteErreur = (() => {
    if (!dateAlerte || !heureAlerte) return null;
    if (dateEcheance && dateAlerte > dateEcheance) return "L'alerte ne peut pas être fixée après la date de fin de l'accord.";
    if (signature && dateAlerte < signature) return "L'alerte ne peut pas être antérieure à la date de signature.";
    const changee = !initial || initial.date_alerte !== dateAlerte || initial.heure_alerte !== heureAlerte;
    if (changee && bornes.max && dateAlerte > bornes.max) return "L'alerte doit être programmée au plus tard la veille de la fin de la convention.";
    if (changee && new Date(`${dateAlerte}T${heureAlerte}`).getTime() <= Date.now()) return "L'alerte ne peut pas être fixée dans le passé.";
    return null;
  })();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (gele) {
      setError("L'alerte a sonné : le dossier est gelé. Aucune modification n'est possible.");
      return;
    }
    if (preavis.trim() !== "" && (isNaN(Number(preavis)) || Number(preavis) < 0)) {
      setError("Le préavis doit être un nombre de mois positif.");
      return;
    }
    if (pdf && (pdf.type !== "application/pdf" || pdf.size > 20 * 1024 * 1024)) {
      setError("Le document doit être un PDF de 20 Mo maximum.");
      return;
    }

    // Sas 2 : on complète uniquement les champs optionnels vides d'origine
    if (stabilise && initial) {
      const maj: Record<string, unknown> = {};
      const completes: string[] = [];
      if (!lockVille && ville.trim()) { maj["partenaire_ville"] = ville.trim(); completes.push("ville"); }
      if (!lockThem && thematique.trim()) { maj["thematique"] = thematique.trim(); completes.push("thématique"); }
      if (!lockPreavis && preavis.trim()) { maj["preavis_mois"] = Math.round(Number(preavis)); completes.push("préavis"); }
      if (JSON.stringify(emailsAlerte) !== JSON.stringify(initial.emails_alerte ?? [])) { maj["emails_alerte"] = emailsAlerte; completes.push("e-mails d'alerte"); }
      if (!Object.keys(maj).length && !pdf) {
        setError("Aucun élément nouveau à compléter.");
        return;
      }
      setBusy(true);
      setError(null);
      if (Object.keys(maj).length) {
        const { error: err } = await supabase.from("conventions").update(maj).eq("id", initial.id);
        if (err) {
          setBusy(false);
          setError("Enregistrement impossible : " + err.message);
          return;
        }
      }
      if (pdf) {
        const err = await envoyerPdf(initial.id, pdf);
        if (err) { setBusy(false); setError(err); return; }
        completes.push("PDF");
      }
      await logHistorique(initial.id, "Convention complétée", "Éléments ajoutés : " + completes.join(", "));
      setBusy(false);
      onSaved(null);
      return;
    }

    if (!poleFinal || !cadreFinal) {
      setError("Veuillez renseigner le pôle et le cadre juridique.");
      return;
    }
    if (!signature || !dateEcheance) {
      setError("Veuillez renseigner la date de signature et la date de fin.");
      return;
    }
    if (dateEcheance <= signature) {
      setError("La date de fin doit être postérieure à la date de signature.");
      return;
    }
    if (!dateAlerte || !heureAlerte) {
      setError("Veuillez renseigner la date et l'heure de l'alerte.");
      return;
    }
    if (alerteErreur) {
      setError(alerteErreur);
      return;
    }
    setBusy(true);
    setError(null);
    if (pole === "__new") {
      await supabase.from("poles").insert({ nom: poleFinal });
    }

    const alerteChangee = !!initial && (initial.date_alerte !== dateAlerte || initial.heure_alerte !== heureAlerte);
    const payload: Record<string, unknown> = {
      pole: poleFinal,
      cadre_juridique: cadreFinal,
      partenaire_nom: nom.trim(),
      partenaire_pays: pays.trim(),
      partenaire_ville: ville.trim() || null,
      thematique: thematique.trim() || null,
      date_signature: signature,
      duree_mois: Math.max(1, dureeCalculee),
      date_echeance: dateEcheance,
      preavis_mois: preavis.trim() === "" ? null : Math.round(Number(preavis)),
      reconduction,
      date_alerte: dateAlerte,
      seuil_alerte_jours: null,
      heure_alerte: heureAlerte,
      emails_alerte: emailsAlerte,
    };
    if (alerteChangee) {
      payload["alarme_arretee_le"] = null;
      payload["alarme_reportee_jusqu_a"] = null;
    }

    const res = initial
      ? await supabase.from("conventions").update(payload).eq("id", initial.id).select("id, created_at").single()
      : await supabase.from("conventions").insert(payload).select("id, created_at").single();
    if (res.error || !res.data) {
      setBusy(false);
      setError("Enregistrement impossible : " + (res.error?.message ?? "erreur inconnue"));
      return;
    }
    const id = res.data.id as string;
    // Enregistrement coordonné : points focaux puis projets (création uniquement)
    const avertissements: string[] = [];
    if (!initial && pointsFocaux.length) {
      const { error: e1 } = await supabase.from("convention_points_focaux").insert(pointsFocaux.map((pf) => ({ ...pf, convention_id: id })));
      if (e1) avertissements.push("points focaux : " + e1.message);
    }
    if (!initial && projets.length) {
      const { error: e2 } = await supabase.from("convention_projets").insert(projets.map((pr) => ({ ...pr, convention_id: id })));
      if (e2) avertissements.push("projets : " + e2.message);
    }
    if (avertissements.length) {
      alert("Convention enregistrée, mais certains éléments n'ont pas pu être ajoutés (" + avertissements.join(" ; ") + "). Vous pourrez les ajouter depuis la fiche.");
    }
    await logHistorique(
      id,
      initial ? "Convention modifiée (fenêtre de 48 h)" : "Convention enregistrée",
      alerteChangee ? `Alerte reprogrammée au ${formatDate(dateAlerte)} à ${heureAlerte}` : null,
    );
    if (pdf) {
      const err = await envoyerPdf(id, pdf);
      if (err) {
        setBusy(false);
        setError(err);
        return;
      }
    }
    setBusy(false);
    onSaved(
      initial
        ? null
        : {
            nom: nom.trim(),
            pole: poleFinal,
            echeance: dateEcheance,
            alerte: `${formatDate(dateAlerte)} à ${heureAlerte}`,
            finCorrection: finFenetreCorrection({ created_at: res.data.created_at as string }),
          },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/50 p-4 sm:py-10">
      <form onSubmit={submit} className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-2xl sm:p-8">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-uk-blue">{!initial ? "Nouvelle convention" : stabilise ? "Compléter la convention" : "Modifier la convention"}</h3>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        {initial && sas === "libre" && (
          <p className="mt-3 rounded-lg bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            Convention récente : modification complète autorisée. Il vous reste environ {heuresRestantes} h pour corriger les erreurs de saisie.
          </p>
        )}
        {stabilise && (
          <p className="mt-3 rounded-lg bg-sky-100 px-3 py-2 text-xs font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
            Dossier stabilisé : seuls les éléments non renseignés à l'origine peuvent être complétés, une seule fois.
          </p>
        )}
        {gele && (
          <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
            L'alerte de cette convention a sonné : le dossier est gelé. Utilisez « Reporter » ou « Avenant ».
          </p>
        )}

        <Step n={1} title="Pôle opérationnel">
          <select required disabled={lockCore} value={pole} onChange={(e) => { setPole(e.target.value); setCadre(""); }} className={inputCls + lk(lockCore)}>
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
              <select required disabled={lockCore} value={cadre} onChange={(e) => setCadre(e.target.value)} className={inputCls + lk(lockCore)}>
                <option value="">— Choisir un type d'accord —</option>
                {cadres.map((c) => (
                  <option key={c}>{c}</option>
                ))}
                <option value="__libre">Autre (saisie libre)</option>
              </select>
            )}
            {(cadre === "__libre" || cadres.length === 0) && (
              <input required disabled={lockCore} placeholder="Préciser le type d'accord" value={cadreLibre} onChange={(e) => setCadreLibre(e.target.value)} className={inputCls + lk(lockCore)} />
            )}
          </Step>
        )}

        {cadreFinal && (
          <Step n={3} title="Informations contractuelles">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={"Partenaire contractant *" + cad(lockCore)} className="sm:col-span-3">
                <input required disabled={lockCore} value={nom} onChange={(e) => setNom(e.target.value)} className={inputCls + lk(lockCore)} />
              </Field>
              <Field label={"Pays *" + cad(lockCore)}>
                <input required disabled={lockCore} value={pays} onChange={(e) => setPays(e.target.value)} className={inputCls + lk(lockCore)} />
              </Field>
              <Field label={"Ville" + cad(lockVille)} className="sm:col-span-2">
                <input disabled={lockVille} value={ville} onChange={(e) => setVille(e.target.value)} className={inputCls + lk(lockVille)} />
              </Field>
              <div className="sm:col-span-3">
                {gele ? (
                  <p className="text-xs text-muted-foreground">E-mails d'alerte : {emailsAlerte.join(", ") || "aucun"}</p>
                ) : (
                  <EmailsAlerteInput value={emailsAlerte} onChange={setEmailsAlerte} label="E-mail(s) du partenaire qui recevra l'alerte" />
                )}
              </div>
              <div className="sm:col-span-3 rounded-lg border border-border p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-uk-blue">Points focaux bipartites</p>
                {initial ? (
                  <p className="text-xs text-muted-foreground">Les points focaux se gèrent depuis la fiche détaillée de la convention, à tout moment.</p>
                ) : (
                  <PointsFocauxEditor
                    items={pointsFocaux}
                    onAdd={(pf) => {
                      const err = validerPointFocal(pf);
                      if (err) return err;
                      setPointsFocaux((l) => [...l, pf]);
                      return null;
                    }}
                    onRemove={(_, i) => setPointsFocaux((l) => l.filter((__, j) => j !== i))}
                  />
                )}
              </div>
              <Field label={"Thématique / domaine d'intervention" + cad(lockThem)} className="sm:col-span-3">
                <input disabled={lockThem} value={thematique} onChange={(e) => setThematique(e.target.value)} className={inputCls + lk(lockThem)} />
              </Field>

              <Field label={"Date de signature *" + cad(lockCore)}>
                <input type="date" required disabled={lockCore} value={signature} onChange={(e) => { setSignature(e.target.value); appliquerDuree(dureeAns, dureeMois, e.target.value); }} className={inputCls + lk(lockCore)} />
              </Field>
              <div className="block text-xs font-medium text-muted-foreground">
                Durée convenue{cad(lockCore)}
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <select aria-label="Années" disabled={lockCore} value={dureeAns} onChange={(e) => appliquerDuree(e.target.value, dureeMois)} className={inputCls.replace("mt-1 ", "") + lk(lockCore)}>
                    <option value="">Années</option>
                    {Array.from({ length: 11 }, (_, i) => (
                      <option key={i} value={i}>{i} an{i > 1 ? "s" : ""}</option>
                    ))}
                  </select>
                  <select aria-label="Mois" disabled={lockCore} value={dureeMois} onChange={(e) => appliquerDuree(dureeAns, e.target.value)} className={inputCls.replace("mt-1 ", "") + lk(lockCore)}>
                    <option value="">Mois</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i}>{i} mois</option>
                    ))}
                  </select>
                </div>
              </div>
              <Field label={"Date de fin de l'accord (échéance) *" + cad(lockCore)}>
                <input type="date" required disabled={lockCore} min={signature || undefined} value={dateEcheance} onChange={(e) => saisirEcheance(e.target.value)} className={inputCls + lk(lockCore)} />
              </Field>
              <p className="sm:col-span-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                Durée réelle : <span className="font-semibold text-uk-blue">{libelleDureeDetaillee(detail)}</span>
                <span className="ml-1">— choisissez années + mois, ou saisissez librement la date de fin au calendrier.</span>
              </p>

              <Field label={"Préavis de dénonciation (mois, optionnel)" + cad(lockPreavis)}>
                <input type="number" min={0} disabled={lockPreavis} value={preavis} placeholder="Optionnel" onChange={(e) => setPreavis(e.target.value)} className={inputCls + lk(lockPreavis)} />
              </Field>
              <Field label={"Reconduction" + cad(lockCore)} className="sm:col-span-2">
                <select disabled={lockCore} value={reconduction} onChange={(e) => setReconduction(e.target.value)} className={inputCls + lk(lockCore)}>
                  <option>Non reconductible</option>
                  <option>Expresse</option>
                  <option>Tacite</option>
                </select>
              </Field>

              <div className="sm:col-span-3 block text-xs font-medium text-muted-foreground">
                Programmation assistée de l'alerte (temps avant la fin)
                <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(["ans", "mois", "semaines", "jours"] as const).map((k) => (
                    <select
                      key={k}
                      aria-label={k}
                      disabled={lockCore || !dateEcheance}
                      value={rebours[k]}
                      onChange={(e) => appliquerRebours({ ...rebours, [k]: Number(e.target.value) })}
                      className={inputCls.replace("mt-1 ", "") + lk(lockCore || !dateEcheance)}
                    >
                      {Array.from({ length: LIMITES_REBOURS[k] + 1 }, (_, i) => (
                        <option key={i} value={i}>
                          {i} {k === "ans" ? (i > 1 ? "ans" : "an") : k === "mois" ? "mois" : k === "semaines" ? (i > 1 ? "semaines" : "semaine") : i > 1 ? "jours" : "jour"}
                        </option>
                      ))}
                    </select>
                  ))}
                </div>
                <p className="mt-1 text-[11px]">
                  {!dateEcheance
                    ? "Renseignez d'abord la date de fin de l'accord."
                    : reboursEstVide(rebours)
                      ? "Choisissez une durée, ou saisissez librement la date ci-dessous."
                      : <>Alerte calculée : <span className="font-semibold text-uk-blue">{formatDate(dateDepuisRebours(dateEcheance, rebours))}</span></>}
                </p>
                {reboursErreur && !lockCore && <p className="mt-1 rounded-md bg-destructive/10 px-2 py-1 font-semibold text-destructive">{reboursErreur}</p>}
              </div>
              <Field label={"Date de l'alerte *" + cad(lockCore)} className="sm:col-span-2">
                <input type="date" required disabled={lockCore} value={dateAlerte} min={bornes.min || undefined} max={bornes.max || undefined} onChange={(e) => { setDateAlerte(e.target.value); setRebours(REBOURS_VIDE); }} className={inputCls + lk(lockCore)} />
              </Field>
              <Field label={"Heure de l'alerte *" + cad(lockCore)}>
                <input type="time" required disabled={lockCore} value={heureAlerte} onChange={(e) => setHeureAlerte(e.target.value)} className={inputCls + lk(lockCore)} />
              </Field>
              {alerteErreur && !lockCore && <p className="sm:col-span-3 rounded-md bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{alerteErreur}</p>}


              <Field label={(initial?.pdf_path ? (lockPdf ? "PDF officiel déjà joint" : "Remplacer le PDF officiel scanné") : "Document PDF officiel scanné (optionnel)") + cad(lockPdf)} className="sm:col-span-3">
                <input type="file" accept="application/pdf" disabled={lockPdf} onChange={(e) => setPdf(e.target.files?.[0] ?? null)} className={inputCls + lk(lockPdf)} />
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

        {cadreFinal && !initial && (
          <Step n={4} title="Projets & Réalisations issus de la convention (optionnel)">
            <ProjetsEditor
              items={projets}
              onSave={(pr, i) => {
                const err = validerProjet(pr);
                if (err) return err;
                setProjets((l) => (i === null ? [...l, pr] : l.map((x, j) => (j === i ? pr : x))));
                return null;
              }}
              onRemove={(_, i) => setProjets((l) => l.filter((__, j) => j !== i))}
            />
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