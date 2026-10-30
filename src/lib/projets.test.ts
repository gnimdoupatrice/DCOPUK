import { describe, expect, it } from "vitest";
import {
  ajouterEmail,
  bornesAlerte,
  controlerDateAlerte,
  dateDepuisRebours,
  destinatairesAlerte,
  projetVide,
  resumerProjets,
  validerPointFocal,
  validerProjet,
  pointFocalVide,
} from "./projets";

describe("projets", () => {
  it("un projet sans intitulé est refusé", () => {
    expect(validerProjet(projetVide())).not.toBeNull();
  });
  it("compte et budget FCFA par convention", () => {
    const m = resumerProjets([
      { convention_id: "a", budget_montant: 1000000, budget_devise: "FCFA" },
      { convention_id: "a", budget_montant: 100, budget_devise: "EUR" },
    ]);
    expect(m.get("a")).toEqual({ count: 2, totalFcfa: 1065596 });
  });
});

describe("e-mails d'alerte", () => {
  it("rejette invalide et doublon", () => {
    expect(typeof ajouterEmail([], "pas-un-mail")).toBe("string");
    expect(typeof ajouterEmail(["a@b.tg"], "A@B.tg")).toBe("string");
  });
  it("la Direction est toujours en premier", () => {
    expect(destinatairesAlerte("dir@uk.tg", ["p@x.fr", "dir@uk.tg"])).toEqual(["dir@uk.tg", "p@x.fr"]);
  });
});

describe("points focaux", () => {
  it("nom, prénom et un contact sont exigés", () => {
    expect(validerPointFocal({ ...pointFocalVide("universite"), nom: "A", prenom: "B" })).not.toBeNull();
    expect(validerPointFocal({ ...pointFocalVide("universite"), nom: "A", prenom: "B", telephone: "90000000" })).toBeNull();
  });
});

describe("compte à rebours de l'alerte", () => {
  it("1 an, 1 mois, 2 semaines, 3 jours avant le 31/12/2028", () => {
    expect(dateDepuisRebours("2028-12-31", { ans: 1, mois: 1, semaines: 2, jours: 3 })).toBe("2027-11-13");
  });
  it("1 mois avant le 31 mars donne la fin février", () => {
    expect(dateDepuisRebours("2027-03-31", { ans: 0, mois: 1, semaines: 0, jours: 0 })).toBe("2027-02-28");
  });
  it("l'alerte ne peut pas tomber le jour de la fin", () => {
    expect(bornesAlerte("2026-01-01", "2028-06-30", "2026-05-01").max).toBe("2028-06-29");
    expect(controlerDateAlerte("2028-06-30", "2026-01-01", "2028-06-30", "2026-05-01")).not.toBeNull();
  });
  it("l'alerte ne peut pas précéder la signature ni aujourd'hui", () => {
    expect(controlerDateAlerte("2025-12-01", "2026-01-01", "2028-06-30", "2025-11-01")).not.toBeNull();
    expect(controlerDateAlerte("2026-03-01", "2026-01-01", "2028-06-30", "2026-05-01")).not.toBeNull();
    expect(controlerDateAlerte("2027-01-01", "2026-01-01", "2028-06-30", "2026-05-01")).toBeNull();
  });
});
