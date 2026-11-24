// Règles de la gestion d'équipe DCOP (invitations, enrôlement, droits). À modifier ici uniquement.

export type Role = "directeur" | "agent";
export interface Acces {
  role: Role;
  actif: boolean;
}

/** Durée de validité d'un lien d'invitation. */
export const VALIDITE_INVITATION_JOURS = 7;

export function expirationInvitation(depuis: Date = new Date()): Date {
  return new Date(depuis.getTime() + VALIDITE_INVITATION_JOURS * 24 * 3600 * 1000);
}

export function invitationUtilisable(
  inv: { expire_le: string; utilisee_le: string | null; revoquee: boolean },
  maintenant: number = Date.now(),
): boolean {
  return !inv.revoquee && !inv.utilisee_le && new Date(inv.expire_le).getTime() > maintenant;
}

/** Un compte ne peut agir (écrire, arrêter une alarme) que s'il est activé. */
export function peutAgir(a: Acces | null): boolean {
  return !!a && a.actif;
}

/** Seul un Directeur actif voit et gère l'équipe. */
export function peutGererEquipe(a: Acces | null): boolean {
  return !!a && a.actif && a.role === "directeur";
}

export interface Enrolement {
  nom: string;
  prenom: string;
  poste: string;
  pole: string;
  telephone: string;
  email: string;
  motDePasse: string;
}

export const MOT_DE_PASSE_MIN = 10;

/** Retourne la liste des erreurs (vide si valide). */
export function erreursEnrolement(e: Enrolement): string[] {
  const err: string[] = [];
  if (!e.nom.trim()) err.push("Le nom est obligatoire.");
  if (!e.prenom.trim()) err.push("Le prénom est obligatoire.");
  if (!e.poste.trim()) err.push("Le poste occupé est obligatoire.");
  if (!e.pole.trim()) err.push("Le pôle est obligatoire.");
  if (!/^\+?[0-9 ]{8,20}$/.test(e.telephone.trim())) err.push("Numéro de téléphone invalide.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email.trim())) err.push("Adresse e-mail invalide.");
  if (e.motDePasse.length < MOT_DE_PASSE_MIN || !/[0-9]/.test(e.motDePasse) || !/[A-Za-z]/.test(e.motDePasse))
    err.push(`Mot de passe : au moins ${MOT_DE_PASSE_MIN} caractères, avec lettres et chiffres.`);
  return err;
}

export function genererJeton(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hacherJeton(jeton: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(jeton));
  return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
