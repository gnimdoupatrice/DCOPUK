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
 * niveau: 'alerte' (doux, ascendant) ou 'urgence' (triple note plus marquée)
 */
export function jouerSignalAlerte(niveau: "alerte" | "urgence" = "alerte") {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
    /* Navigateur  silencieux */
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
  const end = new Date(dateEcheance + "T00:00:00");
  return Math.round((end.getTime() - today.getTime()) / 86_400_000);
}

export function dateLimitePreavis(dateEcheance: string, preavisMois: number): string {
  if (!dateEcheance) return "";
  return ajouterMois(dateEcheance, -preavisMois);
}

export function calculerStatut(dateEcheance: string): Statut {
  const j = joursRestants(dateEcheance);
  if (j < 0) return "expire";
  if (j < SEUIL_URGENCE_JOURS) return "urgence";
  if (j <= SEUIL_ALERTE_JOURS) return "alerte";
  return "actif";
}

export const STATUT_INFO: Record<Statut, { label: string; className: string }> = {
  actif: { label: "Actif", className: "bg-uk-green text-white" },
  alerte: { label: "Alerte 5 mois", className: "bg-uk-orange text-white" },
  urgence: { label: "Urgence < 2 mois", className: "bg-destructive text-destructive-foreground" },
  expire: { label: "Expiré", className: "bg-muted-foreground text-white" },
};

export function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR");
}