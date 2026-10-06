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
  preavis_mois: number | null;
  reconduction: string;
  created_at: string;
  archived?: boolean;
  archived_at?: string | null;
  archive_note?: string | null;
  pdf_path?: string | null;
  seuil_alerte_jours?: number | null;
  date_alerte?: string | null;
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

export function ajouterMois(dateIso: string, mois: number): string {
  return calculerEcheance(dateIso, mois);
}

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

export const SEUIL_URGENCE_JOURS = 60;  // < 2 mois

export function calculerEcheance(dateSignature: string, dureeMois: number): string {
  if (!dateSignature || !dureeMois) return "";
  const d = new Date(dateSignature + "T00:00:00");
  d.setMonth(d.getMonth() + dureeMois);
  return d.toISOString().slice(0, 10);
}

export function dateLimitePreavis(dateEcheance: string, preavisMois: number | null | undefined): string {
  if (!dateEcheance || preavisMois == null) return "";
  const d = new Date(dateEcheance + "T00:00:00");
  d.setMonth(d.getMonth() - (preavisMois || 0));
  return d.toISOString().slice(0, 10);
}

export function joursRestants(dateEcheance: string): number {
  if (!dateEcheance) return 0;
  const now = new Date();
  const target = new Date(dateEcheance + "T00:00:00");
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Statut : expirée (fin dépassée) > urgence (< 60 j) > alerte (date+heure d'alerte atteintes) > en vigueur.
 */
export function calculerStatut(dateEcheance: string, momentAlerte?: Date | null): Statut {
  const j = joursRestants(dateEcheance);
  if (j < 0) return "expire";
  if (j <= SEUIL_URGENCE_JOURS) return "urgence";
  if (momentAlerte && Date.now() >= momentAlerte.getTime()) return "alerte";
  return "actif";
}

export function statutConvention(c: Convention): Statut {
  return calculerStatut(c.date_echeance, momentAlerteConvention(c));
}

export type FiltreCockpit = "" | "actives" | "alerte" | "urgence" | "expire";

export function correspondCockpit(c: Convention, filtre: FiltreCockpit): boolean {
  if (!filtre) return true;
  const j = joursRestants(c.date_echeance);
  if (filtre === "expire") return j < 0;
  if (filtre === "actives") return j >= 0;
  if (filtre === "urgence") return j >= 0 && j <= SEUIL_URGENCE_JOURS;
  if (filtre === "alerte") {
    const m = momentAlerteConvention(c);
    return j >= 0 && !!m && Date.now() >= m.getTime();
  }
  return true;
}

export const STATUT_INFO: Record<
  Statut,
  { label: string; badgeCls: string; className: string; dotCls: string; description: string }
> = {
  actif: {
    label: "En vigueur",
    badgeCls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    dotCls: "bg-emerald-500",
    description: "Convention valide sans urgence immédiate",
  },
  alerte: {
    label: "En alerte",
    badgeCls: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    dotCls: "bg-amber-500",
    description: "Date et heure d'alerte atteintes",
  },
  urgence: {
    label: "Urgence critique",
    badgeCls: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
    className: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
    dotCls: "bg-rose-500 animate-pulse",
    description: "Action immédiate requise avant expiration",
  },
  expire: {
    label: "Expirée",
    badgeCls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
    className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
    dotCls: "bg-zinc-400",
    description: "Date d'échéance dépassée",
  },
};

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/**
 * Retire des mois a une date ISO (yyyy-mm-dd), jour pour jour.
 */
export function retirerMois(dateIso: string, mois: number): string {
  if (!dateIso) return "";
  const d = new Date(dateIso + "T00:00:00");
  const jour = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() - mois);
  const dernierJour = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(jour, dernierJour));
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const j = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${j}`;
}

/**
 * Convertit un seuil exprime en mois en nombre de jours avant l'echeance (jour pour jour).
 */
export function moisVersJours(dateEcheance: string, mois: number): number {
  const cible = retirerMois(dateEcheance, mois);
  if (!cible) return Math.round(mois * 30.44);
  const a = new Date(cible + "T00:00:00").getTime();
  const b = new Date(dateEcheance + "T00:00:00").getTime();
  return Math.max(1, Math.round((b - a) / 86400000));
}

/**
 * Duree en mois entre deux dates ISO (arrondie au mois inferieur).
 */
export function dureeEntreMois(dateDebut: string, dateFin: string): number {
  if (!dateDebut || !dateFin) return 0;
  const a = new Date(dateDebut + "T00:00:00");
  const b = new Date(dateFin + "T00:00:00");
  let mois = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) mois -= 1;
  return Math.max(0, mois);
}

/**
 * Date et heure exactes de l'alarme, choisies par le Directeur (date_alerte + heure_alerte).
 * Repli pour les anciennes fiches : seuil_alerte_jours avant l'échéance. Sinon aucune alerte ce .
 */
export function momentAlerteConvention(c: Convention): Date | null {
  let dateAlerte = c.date_alerte || "";
  if (!dateAlerte && c.date_echeance && c.seuil_alerte_jours && c.seuil_alerte_jours > 0) {
    const d = new Date(c.date_echeance + "T00:00:00");
    d.setDate(d.getDate() - c.seuil_alerte_jours);
    dateAlerte = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  if (!dateAlerte) return null;
  const [hStr, mStr] = (c.heure_alerte || "00:00").split(":");
  const result = new Date(dateAlerte + "T00:00:00");
  result.setHours(parseInt(hStr || "0", 10), parseInt(mStr || "0", 10), 0, 0);
  return isNaN(result.getTime()) ? null : result;
}

export function momentRappel8h(momentInitial: Date): Date {
  return new Date(momentInitial.getTime() + 8 * 60 * 60 * 1000);
}
/** Libellé de l'alarme programmée affiché au registre. */
export function libelleAlarme(c: Convention): string {
  if (c.alarme_arretee_le) return "Alarme acquittée";
  const fmt = (d: Date) =>
    d.toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  if (c.alarme_reportee_jusqu_a) return `Reportée au ${fmt(new Date(c.alarme_reportee_jusqu_a))}`;
  const m = momentAlerteConvention(c);
  return m ? `Alarme : ${fmt(m)}` : "Aucune alarme";
}
