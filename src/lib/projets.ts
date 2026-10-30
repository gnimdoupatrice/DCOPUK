// Règles métier pures (sans Supabase) : projets, points focaux, e-mails d'alerte, compte à rebours de l'alerte.
import { decalerDate, isoLocal } from "@/lib/conventions";

// ---------- Projets & réalisations ----------
export const DEVISES = ["FCFA", "EUR", "USD"] as const;
export type Devise = (typeof DEVISES)[number];
export const DEVISE_DEFAUT: Devise = "FCFA";
/** Taux de conversion vers le FCFA (EUR = parité fixe officielle). */
export const TAUX_FCFA: Record<Devise, number> = { FCFA: 1, EUR: 655.957, USD: 600 };

export interface ConventionProjet {
  id: string;
  convention_id: string;
  titre: string;
  date_debut: string | null;
  date_fin: string | null;
  description: string | null;
  activites: string | null;
  budget_montant: number | null;
  budget_devise: string | null;
  apport_kara: string | null;
  apport_partenaire: string | null;
  lecons_apprises: string | null;
  created_at: string;
}

export type ProjetSaisie = Omit<ConventionProjet, "id" | "convention_id" | "created_at">;

export function projetVide(): ProjetSaisie {
  return {
    titre: "",
    date_debut: null,
    date_fin: null,
    description: null,
    activites: null,
    budget_montant: null,
    budget_devise: DEVISE_DEFAUT,
    apport_kara: null,
    apport_partenaire: null,
    lecons_apprises: null,
  };
}

export function validerProjet(p: ProjetSaisie): string | null {
  if (!p.titre.trim()) return "L'intitulé du projet est obligatoire.";
  if (p.date_debut && p.date_fin && p.date_fin < p.date_debut) return "La date de fin du projet doit suivre sa date de début.";
  if (p.budget_montant != null && (isNaN(p.budget_montant) || p.budget_montant < 0)) return "Le budget doit être un montant positif.";
  return null;
}

export function budgetEnFcfa(p: Pick<ConventionProjet, "budget_montant" | "budget_devise">): number {
  const t = TAUX_FCFA[(p.budget_devise as Devise) ?? "FCFA"] ?? 1;
  return Math.round((p.budget_montant ?? 0) * t);
}

export function resumerProjets(projets: Pick<ConventionProjet, "convention_id" | "budget_montant" | "budget_devise">[]) {
  const m = new Map<string, { count: number; totalFcfa: number }>();
  for (const p of projets) {
    const r = m.get(p.convention_id) ?? { count: 0, totalFcfa: 0 };
    r.count += 1;
    r.totalFcfa += budgetEnFcfa(p);
    m.set(p.convention_id, r);
  }
  return m;
}

export function formatMontant(n: number, devise = "FCFA"): string {
  return `${new Intl.NumberFormat("fr-FR").format(n).replace(/\u202f|\u00a0/g, " ")} ${devise}`;
}

// ---------- Points focaux ----------
export type InstitutionFocal = "universite" | "partenaire";
export interface PointFocal {
  id: string;
  convention_id: string;
  institution_type: InstitutionFocal;
  nom: string;
  prenom: string;
  fonction: string | null;
  email: string | null;
  telephone: string | null;
  recoit_alertes: boolean;
  created_at: string;
}
export type PointFocalSaisie = Omit<PointFocal, "id" | "convention_id" | "created_at">;

export function pointFocalVide(institution_type: InstitutionFocal): PointFocalSaisie {
  return { institution_type, nom: "", prenom: "", fonction: null, email: null, telephone: null, recoit_alertes: false };
}

export function validerPointFocal(p: PointFocalSaisie): string | null {
  if (!p.nom.trim() || !p.prenom.trim()) return "Le nom et le prénom du point focal sont obligatoires.";
  if (!p.email?.trim() && !p.telephone?.trim()) return "Indiquez au moins un contact (e-mail ou téléphone).";
  if (p.email?.trim() && !emailValide(p.email)) return "L'e-mail du point focal est invalide.";
  if (p.recoit_alertes && !p.email?.trim()) return "Un e-mail est requis pour recevoir les alertes.";
  return null;
}

// ---------- E-mails d'alerte ----------
export function normaliserEmail(e: string): string {
  return e.trim().toLowerCase();
}
export function emailValide(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normaliserEmail(e));
}
/** Ajoute un e-mail à la liste ; renvoie la nouvelle liste ou un message d'erreur. */
export function ajouterEmail(liste: string[], e: string): string[] | string {
  const n = normaliserEmail(e);
  if (!emailValide(n)) return "Adresse e-mail invalide.";
  if (liste.includes(n)) return "Cette adresse est déjà ajoutée.";
  return [...liste, n];
}
/** La Direction DCOP est toujours le premier destinataire ; doublons supprimés. */
export function destinatairesAlerte(direction: string, partenaires: (string | null | undefined)[]): string[] {
  const d = normaliserEmail(direction);
  const out = [d];
  for (const e of partenaires) {
    if (!e) continue;
    const n = normaliserEmail(e);
    if (emailValide(n) && !out.includes(n)) out.push(n);
  }
  return out;
}

// ---------- Compte à rebours de l'alerte ----------
export interface Rebours {
  ans: number;
  mois: number;
  semaines: number;
  jours: number;
}
export const REBOURS_VIDE: Rebours = { ans: 0, mois: 0, semaines: 0, jours: 0 };
export const LIMITES_REBOURS = { ans: 12, mois: 11, semaines: 3, jours: 6 } as const;

export function reboursEstVide(r: Rebours): boolean {
  return !r.ans && !r.mois && !r.semaines && !r.jours;
}

/** Date d'alerte = échéance − (ans, mois) avec ajustement fin de mois, puis − (semaines × 7 + jours). */
export function dateDepuisRebours(echeance: string, r: Rebours): string {
  if (!echeance) return "";
  return decalerDate(echeance, -(r.ans * 12 + r.mois), -(r.semaines * 7 + r.jours));
}

/** Bornes autorisées : au plus tôt max(signature, aujourd'hui), au plus tard la veille de l'échéance. */
export function bornesAlerte(signature: string, echeance: string, aujourdhui = isoLocal(new Date())) {
  const min = signature && signature > aujourdhui ? signature : aujourdhui;
  const max = echeance ? decalerDate(echeance, 0, -1) : "";
  return { min, max };
}

/** Contrôle d'une date d'alerte ; renvoie un message ou null. */
export function controlerDateAlerte(date: string, signature: string, echeance: string, aujourdhui?: string): string | null {
  if (!date) return null;
  const { min, max } = bornesAlerte(signature, echeance, aujourdhui);
  if (max && date > max) return "L'alerte doit être programmée au plus tard la veille de la fin de la convention.";
  if (signature && date < signature) return "L'alerte ne peut pas être antérieure à la date de signature.";
  if (date < min) return "L'alerte ne peut pas être fixée dans le passé.";
  return null;
}
