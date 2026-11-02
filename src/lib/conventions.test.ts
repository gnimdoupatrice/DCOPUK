import { afterEach, describe, expect, it, vi } from "vitest";
import { cadresParPole, etatAlerte, type Convention } from "./conventions";

describe("cadresParPole", () => {
  it("un cadre saisi librement devient un modèle du pôle", () => {
    const m = cadresParPole([{ pole: "Partenariat National", cadre_juridique: "Accord territorial" }]);
    expect(m["Partenariat National"]).toContain("Accord territorial");
    expect(m["Partenariat National"]).toContain("Convention spécifique");
  });
  it("un nouveau pôle reçoit ses cadres déjà saisis", () => {
    const m = cadresParPole([{ pole: "Coopération Décentralisée", cadre_juridique: "Protocole local" }]);
    expect(m["Coopération Décentralisée"]).toEqual(["Protocole local"]);
  });
  it("pas de doublon malgré la casse ou les espaces", () => {
    const m = cadresParPole([{ pole: "Partenariat National", cadre_juridique: "  convention   SPÉCIFIQUE " }]);
    expect((m["Partenariat National"] ?? []).filter((c) => c.toLowerCase() === "convention spécifique")).toHaveLength(1);
  });
});

describe("arbitrage de l'alarme", () => {
  afterEach(() => vi.useRealTimers());
  const convention: Convention = {
    id: "alarme-test", pole: "Partenariat National", cadre_juridique: "Convention spécifique",
    partenaire_nom: "Partenaire", partenaire_pays: "Togo", partenaire_ville: null, thematique: null,
    date_signature: "2026-01-01", duree_mois: 12, date_echeance: "2026-12-31",
    preavis_mois: null, reconduction: "Non", created_at: "2026-01-01T00:00:00Z",
    date_alerte: "2026-11-02", heure_alerte: "08:00",
  };
  it("reste en attente d'action après une minute et après huit heures sans arbitrage", () => {
    const debut = new Date("2026-11-02T08:00:00").getTime();
    expect(etatAlerte(convention, debut)).toBe("sonnerie");
    expect(etatAlerte(convention, debut + 60_000)).toBe("sonnerie");
    expect(etatAlerte(convention, debut + 8 * 60 * 60 * 1000)).toBe("sonnerie");
  });
  it("un arrêt définitif empêche une nouvelle sonnerie", () => {
    expect(etatAlerte({ ...convention, alarme_arretee_le: "2026-11-02T08:01:00Z" }, new Date("2026-11-03T08:00:00").getTime())).toBe("arretee");
  });
  it("un report attend l'heure choisie puis redemande un arbitrage", () => {
    const cible = new Date("2026-11-03T10:00:00");
    const reportee = { ...convention, alarme_reportee_jusqu_a: cible.toISOString() };
    expect(etatAlerte(reportee, cible.getTime() - 1)).toBe("reportee");
    expect(etatAlerte(reportee, cible.getTime())).toBe("sonnerie");
  });
});
