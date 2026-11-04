import { momentAlerteConvention, type Convention } from "./conventions";
import { destinatairesAlerte, type PointFocal } from "./projets";

export type TypeEmailAlerte = "alerte" | "report";
export type ConventionEmail = Convention & {
  email_alerte_envoye_pour?: string | null;
  email_report_envoye_pour?: string | null;
};

/** Le calendrier métier reste celui de conventions.ts ; Lomé est à UTC+0. */
export function evenementEmailDu(c: ConventionEmail, now: Date) {
  if (c.archived || c.alarme_arretee_le || c.date_echeance < now.toISOString().slice(0, 10)) return null;
  const type: TypeEmailAlerte = c.alarme_reportee_jusqu_a ? "report" : "alerte";
  const moment = c.alarme_reportee_jusqu_a ? new Date(c.alarme_reportee_jusqu_a) : momentAlerteConvention(c);
  if (!moment || !Number.isFinite(moment.getTime()) || moment.getTime() > now.getTime()) return null;
  return { type, moment, cle: moment.toISOString() };
}

export function destinatairesConvention(direction: string, c: Pick<Convention, "id" | "emails_alerte">, points: Pick<PointFocal, "convention_id" | "email" | "recoit_alertes">[]) {
  return destinatairesAlerte(direction, [
    ...(c.emails_alerte ?? []),
    ...points.filter((p) => p.convention_id === c.id && p.recoit_alertes).map((p) => p.email),
  ]);
}

/** Un échec ne bloque ni la Direction ni les autres adresses ; seuls les succès sont mémorisés. */
export async function envoyerDestinataires(
  destinataires: string[],
  dejaEnvoyes: Set<string>,
  envoyer: (email: string) => Promise<void>,
  memoriser: (email: string) => Promise<void>,
  noterEchec?: (email: string, err: unknown) => Promise<void>,
  plafond = Infinity,
) {
  let envoyes = 0;
  let erreurs = 0;
  for (const email of destinataires) {
    if (dejaEnvoyes.has(email)) continue;
    if (envoyes + erreurs >= plafond) break;
    try {
      await envoyer(email);
      await memoriser(email);
      dejaEnvoyes.add(email);
      envoyes += 1;
    } catch (err) {
      erreurs += 1;
      if (noterEchec) await noterEchec(email, err).catch(() => {});
    }
  }
  return { envoyes, erreurs };
}

/* ---------- Diagnostic en langage clair ---------- */

export const PLAFOND_EMAILS_PAR_PASSAGE = 20;
export const TENTATIVES_MAX = 3;

export class EchecEnvoi extends Error {
  constructor(public statutHttp: number | null) {
    super(statutHttp ? `Échec d'envoi (${statutHttp})` : "Échec d'envoi (réseau)");
  }
}

/** Traduit un échec technique en phrase compréhensible et indique s'il est inutile de réessayer. */
export function motifErreurClair(statutHttp: number | null): { motif: string; definitif: boolean } {
  if (statutHttp === 422 || statutHttp === 400)
    return { motif: "Adresse e-mail mal orthographiée ou inexistante.", definitif: true };
  if (statutHttp === 401 || statutHttp === 403)
    return { motif: "Le domaine d'envoi de l'Université n'est pas encore validé auprès du service d'e-mails.", definitif: true };
  if (statutHttp === 429)
    return { motif: "Le quota journalier d'e-mails a été atteint ; un nouvel essai aura lieu plus tard.", definitif: false };
  if (statutHttp && statutHttp >= 500)
    return { motif: "Le service d'envoi était momentanément indisponible ; un nouvel essai aura lieu plus tard.", definitif: false };
  return { motif: "La connexion au service d'envoi a échoué ; un nouvel essai aura lieu plus tard.", definitif: false };
}

export type ReceiptEnvoi = {
  convention_id: string;
  type_evenement: TypeEmailAlerte;
  moment_evenement: string;
  destinataire: string;
  statut?: "envoye" | "echec" | null;
  motif_erreur?: string | null;
  definitif?: boolean | null;
  tentatives?: number | null;
  envoye_le?: string | null;
};

/** Destinataire à ne plus solliciter : déjà reçu, échec définitif, ou essais épuisés. */
export function receiptClos(r: Pick<ReceiptEnvoi, "statut" | "definitif" | "tentatives">): boolean {
  if (!r.statut || r.statut === "envoye") return true;
  return !!r.definitif || (r.tentatives ?? 0) >= TENTATIVES_MAX;
}

export type EtatSuivi = "envoye" | "echec" | "attente";
export function etatSuivi(r: ReceiptEnvoi | undefined): EtatSuivi {
  if (!r) return "attente";
  if (!r.statut || r.statut === "envoye") return "envoye";
  return receiptClos(r) ? "echec" : "attente";
}
