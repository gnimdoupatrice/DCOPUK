export const DEFAULT_POLES = [
  "Partenariat National",
  "Partenariat International",
  "Mobilité Internationale",
  "Projets & Programmes",
];

export const CADRES_PAR_POLE: Record<string, string[]> = {
  "Partenariat National": [
    "Convention-cadre de partenariat",
    "Convention spécifique",
    "Protocole d'accord",
    "Contrat de prestation",
  ],
  "Partenariat International": [
    "Accord-cadre de coopération",
    "Mémorandum d'entente (MoU)",
    "Convention de co-tutelle / co-diplomation",
    "Accord de recherche conjointe",
  ],
  "Mobilité Internationale": [
    "Accord de mobilité Erasmus+",
    "Accord d'échange d'étudiants",
    "Accord de mobilité du personnel",
    "Convention de stage international",
  ],
  "Projets & Programmes": [
    "Convention de financement",
    "Accord de consortium",
    "Contrat de subvention",
    "Accord de mise en œuvre de projet",
  ],
};

export interface Convention {
  id: string;
  pole: string;
  cadre_juridique: string;
  partenaire_nom: string;
  partenaire_pays: string;
  partenaire_ville: string | null;
  thematique: string | null;
  date_signature: string;
  duree_mois: number;
  date_echeance: string;
  preavis_mois: number;
  reconduction: string;
  created_at: string;
  archived?: boolean;
  archived_at?: string | null;
  archive_note?: string | null;
  pdf_path?: string | null;
  seuil_alerte_jours?: number | null;
  heure_alerte?: string | null;
  alarme_arretee_le?: string | null;
  alarme_reportee_jusqu_a?: string | null;
}

export interface HistoriqueEntry {
  id: string;
  convention_id: string;
  action: string;
  note: string | null;
  created_at: string;
}

export const PDF_BUCKET = "conventions-pdf";
export const PDF_MAX_OCTETS = 20 * 1024 * 1024;

/** Ajoute des mois à une date ISO (yyyy-mm-dd). */
export function ajouterMois(dateIso: string, mois: number): string {
  return calculerEcheance(dateIso, mois);
}

/** 
 * Joue un carillon Web Audio sans fichier externe.
 */
export function jouerSignalAlerte(niveau: "alerte" | "urgence" = "alerte") {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();

    if (niveau === "alerte") {
      const notes = [
        { f: 659.25, start: 0, dur: 0.18 },
        { f: 880.0, start: 0.2, dur: 0.35 },
      ];
      notes.forEach(({ f, start, dur }) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + start);
        o.stop(ctx.currentTime + start + dur);
      });
      setTimeout(() => ctx.close(), 800);
    } else {
      const notes = [
        { f: 880, start: 0, dur: 0.12 },
        { f: 880, start: 0.16, dur: 0.12 },
        { f: 1046.5, start: 0.32, dur: 0.25 },
      ];
      notes.forEach(({ f, start, dur }) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "triangle";
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + start);
        o.stop(ctx.currentTime + start + dur);
      });
      setTimeout(() => ctx.close(), 1000);
    }
  } catch {
    /* Navigateur silencieux */
  }
}

export type Statut = "actif" | "alerte" | "urgence" | "expire";

export const SEUIL_ALERTE_JOURS = 150; // J-5 mois
export const SEUIL_URGENCE_JOURS = 60; // < 2 mois

export function calculerEcheance(dateSignature: string, dureeMois: number): string {
  if (!dateSignature || !dureeMois) return "";
  const d = new Date(dateSignature + "T00:00:00");
  d.setMonth(d.getMonth() + dureeMois);
  return d.toISOString().slice(0, 10);
}

export function joursRestants(dateEcheance: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateEcheance + "T00:00:00");
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function calculerStatut(dateEcheance: string): Statut {
  const j = joursRestants(dateEcheance);
  if (j < 0) return "expire";
  if (j < SEUIL_URGENCE_JOURS) return "urgence";
  if (j <= SEUIL_ALERTE_JOURS) return "alerte";
  return "actif";
}

/** Seuil d'alerte effectif : personnalisé si défini, sinon règle générale J-150. */
export function seuilDe(c: Pick<Convention, "seuil_alerte_jours">): number {
  return c.seuil_alerte_jours != null && c.seuil_alerte_jours >= 0
    ? c.seuil_alerte_jours
    : SEUIL_ALERTE_JOURS;
}

/** Calcule le moment exact (Date) du premier déclenchement de l'alarme pour une convention. */
export function momentAlerteConvention(c: Convention): Date {
  const seuilJours = seuilDe(c);
  const echeance = new Date(c.date_echeance + "T00:00:00");
  // Date du jour J d'alerte
  const dateDeclenchement = new Date(echeance.getTime() - seuilJours * 24 * 60 * 60 * 1000);
  
  // Heure précise (défaut : 00:00)
  const heureStr = (c.heure_alerte && c.heure_alerte.trim()) ? c.heure_alerte.trim() : "00:00";
  const [h, m] = heureStr.split(":").map((v) => parseInt(v, 10) || 0);
  dateDeclenchement.setHours(h, m, 0, 0);
  return dateDeclenchement;
}

/** Calcule le moment de la deuxième sonnerie (+8h après la première). */
export function momentRappel8h(c: Convention): Date {
  const premiere = momentAlerteConvention(c);
  return new Date(premiere.getTime() + 8 * 60 * 60 * 1000);
}

export function dateLimitePreavis(dateEcheance: string, preavisMois: number): string | null {
  if (!preavisMois || preavisMois <= 0) return null;
  const d = new Date(dateEcheance + "T00:00:00");
  d.setMonth(d.getMonth() - preavisMois);
  return d.toISOString().slice(0, 10);
}

export function preavisAtteint(c: Pick<Convention, "date_echeance" | "preavis_mois">): boolean {
  const lim = dateLimitePreavis(c.date_echeance, c.preavis_mois);
  if (!lim) return false;
  return new Date() >= new Date(lim + "T00:00:00");
}

export function filtrerParFiltre(
  c: Convention,
  f: "total" | "actif" | "alerte" | "urgence" | "expire",
): boolean {
  if (c.archived) return false;
  const j = joursRestants(c.date_echeance);
  if (f === "total") return true;
  if (f === "expire") return j < 0;
  if (j < 0) return false;
  if (f === "actif") return j > seuilDe(c) && !preavisAtteint(c);
  if (f === "alerte") return j <= seuilDe(c);
  return j < SEUIL_URGENCE_JOURS || preavisAtteint(c);
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export const STATUT_INFO: Record<
  Statut,
  { label: string; badgeCls: string; dotCls: string; description: string }
> = {
  actif: {
    label: "Actif",
    badgeCls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    dotCls: "bg-emerald-500",
    description: "Convention en cours, au-delà du seuil d'alerte.",
  },
  alerte: {
    label: "Alerte (< 5 mois)",
    badgeCls: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    dotCls: "bg-amber-500",
    description: "Entrée dans la zone des 5 mois avant échéance.",
  },
  urgence: {
    label: "Urgence critique (< 2 mois)",
    badgeCls: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
    dotCls: "bg-rose-500",
    description: "Échéance imminente ou préavis contractuel atteint.",
  },
  expire: {
    label: "Expirée",
    badgeCls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
    dotCls: "bg-zinc-400",
    description: "Date d'échéance dépassée.",
  },
};