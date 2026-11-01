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
) {
  let envoyes = 0;
  let erreurs = 0;
  for (const email of destinataires) {
    if (dejaEnvoyes.has(email)) continue;
    try {
      await envoyer(email);
      await memoriser(email);
      dejaEnvoyes.add(email);
      envoyes += 1;
    } catch {
      erreurs += 1;
    }
  }
  return { envoyes, erreurs };
}