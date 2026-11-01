import { describe, expect, it } from "vitest";
import { cadresParPole } from "./conventions";

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
