import { describe, expect, it } from "vitest";
import { envoyerDestinataires, etatSuivi, motifErreurClair, receiptClos } from "./alertes-email";

describe("diagnostic des envois en langage clair", () => {
  it("adresse invalide : motif clair et pas de nouvel essai", () => {
    expect(motifErreurClair(422)).toEqual({ motif: "Adresse e-mail mal orthographiée ou inexistante.", definitif: true });
  });
  it("quota atteint : nouvel essai prévu", () => {
    expect(motifErreurClair(429).definitif).toBe(false);
  });
  it("un échec temporaire est retenté au plus 3 fois", () => {
    expect(receiptClos({ statut: "echec", definitif: false, tentatives: 2 })).toBe(false);
    expect(receiptClos({ statut: "echec", definitif: false, tentatives: 3 })).toBe(true);
    expect(etatSuivi({ statut: "echec", definitif: true, tentatives: 1 } as never)).toBe("echec");
  });
  it("plafond par passage respecté", async () => {
    const envoyes: string[] = [];
    await envoyerDestinataires(["a@x.org", "b@x.org", "c@x.org"], new Set(), async (e) => { envoyes.push(e); }, async () => {}, undefined, 2);
    expect(envoyes).toEqual(["a@x.org", "b@x.org"]);
  });
  it("l'échec d'envoi est noté, pas l'échec d'enregistrement", async () => {
    const notes: string[] = [];
    await envoyerDestinataires(["ko@x.org", "ok@x.org"], new Set(), async (e) => { if (e === "ko@x.org") throw new Error(); }, async () => { throw new Error(); }, async (e) => { notes.push(e); });
    expect(notes).toEqual(["ko@x.org"]);
  });
});
