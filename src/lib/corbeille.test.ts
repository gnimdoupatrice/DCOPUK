import { describe, expect, it } from "vitest";
import { alerteEchueARestaurer, joursAvantPurge, trouverDoublonStrict, type Convention } from "./conventions";

const base = {
  id: "a", pole: "Partenariat International", cadre_juridique: "MoU", partenaire_nom: "Université de Lomé",
  partenaire_pays: "Togo", partenaire_ville: null, thematique: null, date_signature: "2024-01-10",
  duree_mois: 36, date_echeance: "2027-01-10", preavis_mois: null, reconduction: "Non reconductible",
  created_at: "2024-01-10T00:00:00Z",
} as Convention;

describe("corbeille", () => {
  it("purge après 30 jours", () => {
    const now = new Date("2026-06-01T00:00:00Z").getTime();
    expect(joursAvantPurge({ ...base, supprime_le: "2026-06-01T00:00:00Z" }, now)).toBe(30);
    expect(joursAvantPurge({ ...base, supprime_le: "2026-05-02T00:00:00Z" }, now)).toBe(0);
  });
  it("doublon seulement si partenaire, pôle, signature et fin identiques", () => {
    const copie = { ...base, id: "b", partenaire_nom: "  université de lomé " };
    expect(trouverDoublonStrict(base, [copie])?.id).toBe("b");
    expect(trouverDoublonStrict(base, [{ ...copie, date_echeance: "2028-01-10" }])).toBeNull();
    expect(trouverDoublonStrict(base, [{ ...copie, date_signature: "2023-01-10" }])).toBeNull();
    expect(trouverDoublonStrict(base, [{ ...copie, pole: "Partenariat National" }])).toBeNull();
  });
  it("alerte échue détectée à la restauration, sauf si arrêtée", () => {
    const now = new Date("2026-06-18T10:00:00").getTime();
    const c = { ...base, date_alerte: "2026-06-10", heure_alerte: "08:00" };
    expect(alerteEchueARestaurer(c, now)).toBe(true);
    expect(alerteEchueARestaurer({ ...c, date_alerte: "2026-07-01" }, now)).toBe(false);
    expect(alerteEchueARestaurer({ ...c, alarme_arretee_le: "2026-06-11T00:00:00Z" }, now)).toBe(false);
  });
});
