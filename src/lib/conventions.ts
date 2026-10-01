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
