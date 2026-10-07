import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CriticalAlarm } from "@/components/dcop/CriticalAlarm";
import { RegulariserAlerte } from "@/components/dcop/RegulariserAlerte";
import { InstallPwa } from "@/components/dcop/InstallPwa";
import type { Session } from "@supabase/supabase-js";
import {
  AlertTriangle,
  Clock,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  Bell,
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
import {
  CADRES_PAR_POLE,
  DEFAULT_POLES,
  etatAlerte,
  SOUS_MENTION_ALERTE,
  STATUT_INFO,
  ajouterMois,
  calculerEcheance,
  calculerStatut,
  statutConvention,
  momentAlerteConvention,
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const [modifierReportId, setModifierReportId] = useState<string | null>(null);
  const [alertesEnAttente, setAlertesEnAttente] = useState(true);
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
    const [c, p] = await Promise.all([
      supabase.from("conventions").select("*"),
      supabase.from("poles").select("nom").order("created_at"),
    ]);
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
    if (!p.error && p.data?.length) {
      setPoles(Array.from(new Set([...DEFAULT_POLES, ...p.data.map((r) => r.nom as string)])));
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // Rafraîchissement silencieux du registre toutes les 60 s
    const id = window.setInterval(async () => {
      const { data, error } = await supabase.from("conventions").select("*");
      if (!error && data) setConventions(data as Convention[]);
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const actives = useMemo(() => conventions.filter((c) => !c.archived), [conventions]);
  const selected = conventions.find((c) => c.id === selectedId) ?? null;

  async function supprimerDirect(id: string, nom: string, pdfPath?: string | null) {
    if (!window.confirm(`Supprimer définitivement la convention avec « ${nom} » ?`)) return;
    try {
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Kpi icon={FileSignature} label="Total des accords" value={stats.total} tone="text-uk-blue" active={fCockpit === ""} onClick={() => filtrerCockpit("")} />
            <Kpi icon={FileSignature} label="En vigueur" value={stats.enCours} tone="text-uk-green" active={fCockpit === "actives"} onClick={() => filtrerCockpit("actives")} />
            <Kpi icon={AlertTriangle} label="Alertes dépassées sans action" value={stats.depassee} tone="text-destructive" active={fCockpit === "depassee"} onClick={() => filtrerCockpit("depassee")} />
            <Kpi icon={AlertTriangle} label="Alertes reportées" value={stats.reportee} tone="text-uk-orange" active={fCockpit === "reportee"} onClick={() => filtrerCockpit("reportee")} />
            <Kpi icon={Layers} label="Alertes arrêtées définitivement" value={stats.arretee} tone="text-uk-blue" active={fCockpit === "arretee"} onClick={() => filtrerCockpit("arretee")} />
            <Kpi icon={Layers} label="Expirées" value={stats.expire} tone="text-muted-foreground" active={fCockpit === "expire"} onClick={() => filtrerCockpit("expire")} />
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
                  {{ actives: "En vigueur", depassee: "Alertes dépassées sans action", reportee: "Alertes reportées", arretee: "Alertes arrêtées définitivement", expire: "Expirées" }[fCockpit]}
                </strong>
              </span>
              <button onClick={() => setFCockpit("")} className="ml-auto rounded-md bg-uk-blue px-3 py-1 text-xs font-semibold text-primary-foreground hover:brightness-110">
                Réinitialiser le filtre
              </button>
            </div>
          )}

          {loadError && <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{loadError}</p>}

          <p className="mt-3 text-xs text-muted-foreground">Cliquez sur une ligne pour ouvrir la fiche détaillée.</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-uk-blue text-primary-foreground">
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
                  <th className="px-3 py-2.5 font-semibold">Préavis & Alerte</th>
                  <th className="px-3 py-2.5 font-semibold">Actions</th>
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
                      className={`cursor-pointer border-b border-border align-top hover:bg-muted focus:bg-muted focus:outline-none ${
                        alarmeActiveId === c.id ? "animate-pulse bg-destructive/10 ring-2 ring-inset ring-destructive/50" : ""
                      }`}
                    >
                      <td className="px-3 py-3">
                        <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STATUT_INFO[c.statut].className}`}>
                          {STATUT_INFO[c.statut].label}
                        </span>
                        {c.statut === "actif" && SOUS_MENTION_ALERTE[c.etat] && (
                          <p className={`mt-1 text-[11px] font-semibold ${SOUS_MENTION_ALERTE[c.etat]!.cls}`}>
                            {SOUS_MENTION_ALERTE[c.etat]!.label}
                          </p>
                        )}
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
                        <p className="font-medium text-foreground">{c.preavis_mois == null ? "Préavis —" : `${c.preavis_mois} mois`}</p>
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
                        <p className={`mt-2 border-t border-border pt-1 font-medium ${c.etat === "depassee" ? "text-destructive" : "text-uk-blue"}`}>
                          <span className="font-semibold">Alerte : </span>
                          {libelleAlarme(c)}
                          {c.statut === "actif" && c.etat === "reportee" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setModifierReportId(c.id);
                              }}
                              title="Modifier ou prolonger le report"
                              aria-label="Modifier ou prolonger le report"
                              className="ml-1 inline-flex align-middle rounded p-0.5 text-uk-orange hover:bg-uk-orange/15"
                            >
                              <Clock className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </p>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {c.statut === "actif" && c.etat === "depassee" && (
                            <button
                              type="button"
                              onClick={() => setRegulariserId(c.id)}
                              title="Reporter ou arrêter définitivement l'alerte"
                              className="inline-flex items-center gap-1 rounded bg-destructive px-2 py-1 text-xs font-semibold text-destructive-foreground hover:brightness-110"
                            >
                              <AlertTriangle className="h-3.5 w-3.5" /> Régulariser
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedId(c.id)}
                            title="Fiche détaillée et avenant"
                            className="inline-flex items-center gap-1 rounded bg-uk-blue/10 px-2 py-1 text-xs font-semibold text-uk-blue hover:bg-uk-blue hover:text-white"
                          >
                            <Eye className="h-3.5 w-3.5" /> Détails
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(c);
                              setShowForm(true);
                            }}
                            title="Modifier les données ou joindre un PDF"
                            className="inline-flex items-center gap-1 rounded bg-uk-gold/20 px-2 py-1 text-xs font-semibold text-uk-navy hover:bg-uk-gold"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Modifier
                          </button>
                          {c.pdf_path && (
                            <button
                              type="button"
                              onClick={() => ouvrirPdfDirect(c.pdf_path!)}
                              title="Ouvrir le document PDF"
                              className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs font-semibold text-foreground hover:bg-border"
                            >
                              <FileText className="h-3.5 w-3.5 text-uk-blue" /> PDF
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => supprimerDirect(c.id, c.partenaire_nom, c.pdf_path)}
                            title="Supprimer la convention"
                            className="inline-flex items-center gap-1 rounded bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive hover:text-white"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Supprimer
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
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            setEditing(null);
            load();
          }}
        />
      )}

      <CriticalAlarm conventions={conventions} onRefresh={load} onActiveChange={setAlarmeActiveId} onPendingChange={setAlertesEnAttente} />
      {modifierReportId && conventions.find((c) => c.id === modifierReportId) && (
        <RegulariserAlerte
          modifierReport
          convention={conventions.find((c) => c.id === modifierReportId)!}
          onClose={() => setModifierReportId(null)}
          onDone={load}
        />
      )}
      {regulariserId && conventions.find((c) => c.id === regulariserId) && (
        <RegulariserAlerte
          convention={conventions.find((c) => c.id === regulariserId)!}
          onClose={() => setRegulariserId(null)}
          onDone={load}
        />
      )}
      {resumeConnexion && !alertesEnAttente && !alarmeActiveId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={() => setResumeConnexion(false)}>
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-heading text-lg font-bold text-uk-blue">Bienvenue — point de situation</h2>
            <p className="mt-1 text-xs text-muted-foreground">Synthèse du registre des conventions à votre connexion.</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex justify-between rounded-lg bg-emerald-100 px-3 py-2 font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"><span>Conventions en vigueur</span><span>{resumeStats.enVigueur}</span></li>
              <li className="flex justify-between rounded-lg bg-rose-100 px-3 py-2 font-semibold text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"><span>Alertes dépassées sans action</span><span>{resumeStats.depassee}</span></li>
              <li className="flex justify-between rounded-lg bg-amber-100 px-3 py-2 font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"><span>Alertes reportées</span><span>{resumeStats.reportee}</span></li>
              <li className="flex justify-between rounded-lg bg-sky-100 px-3 py-2 font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"><span>Alertes arrêtées définitivement</span><span>{resumeStats.arretee}</span></li>
              <li className="flex justify-between rounded-lg bg-zinc-200 px-3 py-2 font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"><span>Conventions expirées</span><span>{resumeStats.expire}</span></li>
            </ul>
            <button type="button" onClick={() => setResumeConnexion(false)} className="mt-5 w-full rounded-lg bg-uk-blue px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110">J'ai compris</button>
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
  onClick,
}: {
  icon: typeof Layers;
  label: string;
  value: number;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl bg-card p-5 text-left shadow-sm ring-2 transition hover:-translate-y-0.5 hover:shadow-md ${
        active ? "ring-uk-blue" : "ring-transparent"
      }`}
    >
      <Icon className={`h-5 w-5 ${tone}`} />
      <p className={`mt-3 text-3xl font-extrabold ${tone}`}>{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </button>
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

  // Dates et échéances
  const [signature, setSignature] = useState(initial?.date_signature ?? "");
  const [dateEcheance, setDateEcheance] = useState(initial?.date_echeance ?? "");

  // Paramétrage de l'alerte
  const [dateAlerte, setDateAlerte] = useState<string>(initial?.date_alerte ?? "");
  const [heureAlerte, setHeureAlerte] = useState<string>(initial?.heure_alerte ?? "");

  const [preavis, setPreavis] = useState<string>(initial?.preavis_mois != null ? String(initial.preavis_mois) : "");
  const [reconduction, setReconduction] = useState(initial?.reconduction ?? "Non reconductible");
  const [pdf, setPdf] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const poleFinal = pole === "__new" ? nouveauPole.trim() : pole;
  const cadres = CADRES_PAR_POLE[poleFinal] ?? [];
  const cadreFinal = cadre === "__libre" || cadres.length === 0 ? cadreLibre.trim() : cadre;

  const dureeCalculee = signature && dateEcheance ? dureeEntreMois(signature, dateEcheance) : 0;
  const momentAlerte = dateAlerte && heureAlerte ? momentAlerteConvention({ date_alerte: dateAlerte, heure_alerte: heureAlerte } as Convention) : null;
  const statut = dateEcheance ? calculerStatut(dateEcheance, momentAlerte) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!poleFinal || !cadreFinal) {
      setError("Veuillez renseigner le pôle et le cadre juridique.");
      return;
    }
    if (!signature || !dateEcheance) {
      setError("Veuillez renseigner la date de signature et la date de fin.");
      return;
    }
    if (new Date(dateEcheance) <= new Date(signature)) {
      setError("La date de fin doit être postérieure à la date de signature.");
      return;
    }
    if (!dateAlerte || !heureAlerte) {
      setError("Veuillez renseigner la date et l'heure de l'alerte.");
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
      duree_mois: Math.max(1, dureeCalculee),
      date_echeance: dateEcheance,
      preavis_mois: preavis.trim() === "" ? null : Math.round(Number(preavis)),
      reconduction,
      date_alerte: dateAlerte,
      seuil_alerte_jours: null,
      heure_alerte: heureAlerte,
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
              <Field label="Date de fin de l'accord (échéance) *">
                <input type="date" required value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Durée (calculée)">
                <input readOnly value={signature && dateEcheance ? `${dureeCalculee} mois` : "—"} className={inputCls + " bg-muted font-medium text-uk-blue"} />
              </Field>

              <Field label="Préavis de dénonciation (mois, optionnel)">
                <input type="number" min={0} value={preavis} placeholder="Optionnel" onChange={(e) => setPreavis(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Reconduction" className="sm:col-span-2">
                <select value={reconduction} onChange={(e) => setReconduction(e.target.value)} className={inputCls}>
                  <option>Non reconductible</option>
                  <option>Expresse</option>
                  <option>Tacite</option>
                </select>
              </Field>

              <Field label="Date de l'alerte *" className="sm:col-span-2">
                <input type="date" required value={dateAlerte} onChange={(e) => setDateAlerte(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Heure de l'alerte *">
                <input type="time" required value={heureAlerte} onChange={(e) => setHeureAlerte(e.target.value)} className={inputCls} />
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