import { describe, expect, it } from "vitest";
import { destinatairesConvention, envoyerDestinataires, evenementEmailDu, type ConventionEmail } from "./alertes-email";

const convention: ConventionEmail = {
  id: "c1", pole: "Partenariat National", cadre_juridique: "Convention spécifique",
  partenaire_nom: "Partenaire", partenaire_pays: "Togo", partenaire_ville: null,
  thematique: null, date_signature: "2026-01-01", duree_mois: 12,
  date_echeance: "2026-12-31", preavis_mois: null, reconduction: "Non reconductible",
  created_at: "2026-01-01T00:00:00Z", date_alerte: "2026-11-01", heure_alerte: "05:00",
  emails_alerte: [" PARTENAIRE@example.org ", "direction@example.org", "invalide"],
};
const maintenant = new Date("2026-11-01T05:14:00Z");

describe("destinataires des alertes", () => {
  it("Direction d’abord, partenaires et points focaux assignés sans doublons", () => {
    expect(destinatairesConvention("direction@example.org", convention, [
      { convention_id: "c1", email: "focal@example.org", recoit_alertes: true },
      { convention_id: "c1", email: "PARTENAIRE@example.org", recoit_alertes: true },
      { convention_id: "c1", email: "non-assigne@example.org", recoit_alertes: false },
      { convention_id: "c2", email: "autre@example.org", recoit_alertes: true },
    ])).toEqual(["direction@example.org", "partenaire@example.org", "focal@example.org"]);
  });
  it("un partenaire en échec n’empêche pas le point focal de recevoir son alerte", async () => {
    const tentatives: string[] = [];
    const succes: string[] = [];
    const result = await envoyerDestinataires(["direction@example.org", "erreur@example.org", "focal@example.org"], new Set(), async (email) => {
      tentatives.push(email);
      if (email === "erreur@example.org") throw new Error("Refus");
    }, async (email) => { succes.push(email); });
    expect(tentatives).toEqual(["direction@example.org", "erreur@example.org", "focal@example.org"]);
    expect(succes).toEqual(["direction@example.org", "focal@example.org"]);
    expect(result).toEqual({ envoyes: 2, erreurs: 1 });
  });
  it("la relance retente seulement les destinataires en échec", async () => {
    const receipts = new Set<string>();
    await envoyerDestinataires(["direction@example.org", "partenaire@example.org"], receipts, async (email) => {
      if (email === "partenaire@example.org") throw new Error("Refus");
    }, async () => {});
    const retries: string[] = [];
    await envoyerDestinataires(["direction@example.org", "partenaire@example.org"], receipts, async (email) => { retries.push(email); }, async () => {});
    expect(retries).toEqual(["partenaire@example.org"]);
  });
  it("un échec de mémorisation est signalé et reste à reprendre", async () => {
    const receipts = new Set<string>();
    expect(await envoyerDestinataires(["direction@example.org"], receipts, async () => {}, async () => { throw new Error("Base indisponible"); })).toEqual({ envoyes: 0, erreurs: 1 });
    expect(receipts.size).toBe(0);
  });
});

describe("déclenchement des e-mails", () => {
  it("respecte la date et l’heure programmées", () => {
    expect(evenementEmailDu(convention, new Date("2026-11-01T04:59:59Z"))).toBeNull();
    expect(evenementEmailDu(convention, maintenant)?.cle).toBe("2026-11-01T05:00:00.000Z");
  });
  it("n’envoie pas d’alerte pour une convention expirée", () => {
    expect(evenementEmailDu({ ...convention, date_echeance: "2026-10-31" }, maintenant)).toBeNull();
  });
  it("n’envoie pas d’alerte pour une convention archivée", () => {
    expect(evenementEmailDu({ ...convention, archived: true }, maintenant)).toBeNull();
  });
  it("respecte l’arrêt définitif", () => {
    expect(evenementEmailDu({ ...convention, alarme_arretee_le: "2026-11-01T05:01:00Z" }, maintenant)).toBeNull();
  });
  it("le report remplace l’alerte initiale et attend l’heure choisie", () => {
    const c = { ...convention, alarme_reportee_jusqu_a: "2026-11-02T06:00:00Z" };
    expect(evenementEmailDu(c, maintenant)).toBeNull();
    expect(evenementEmailDu(c, new Date("2026-11-02T06:00:00Z"))?.type).toBe("report");
  });
});