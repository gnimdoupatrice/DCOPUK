import { describe, expect, it } from "vitest";
import { erreursEnrolement, expirationInvitation, hacherJeton, invitationUtilisable, peutAgir, peutGererEquipe } from "./equipe";

const base = { nom: "Mensah", prenom: "Koffi", poste: "Chargé de mobilité", pole: "Mobilité Internationale", telephone: "+228 90 00 00 00", email: "k@univkara.tg", motDePasse: "motdepasse12" };

describe("équipe DCOP", () => {
  it("un lien expire après 7 jours", () => {
    const d = new Date("2026-11-24T10:00:00Z");
    expect(expirationInvitation(d).toISOString()).toBe("2026-12-01T10:00:00.000Z");
  });
  it("un lien déjà utilisé ne sert plus", () => {
    expect(invitationUtilisable({ expire_le: "2099-01-01", utilisee_le: "2026-11-24", revoquee: false })).toBe(false);
  });
  it("un lien expiré ne sert plus", () => {
    expect(invitationUtilisable({ expire_le: "2020-01-01", utilisee_le: null, revoquee: false })).toBe(false);
  });
  it("un lien valide est utilisable", () => {
    expect(invitationUtilisable({ expire_le: "2099-01-01", utilisee_le: null, revoquee: false })).toBe(true);
  });
  it("un agent non activé ne peut rien modifier", () => {
    expect(peutAgir({ role: "agent", actif: false })).toBe(false);
  });
  it("un agent activé peut agir mais pas gérer l'équipe", () => {
    expect(peutAgir({ role: "agent", actif: true })).toBe(true);
    expect(peutGererEquipe({ role: "agent", actif: true })).toBe(false);
  });
  it("le Directeur gère l'équipe", () => {
    expect(peutGererEquipe({ role: "directeur", actif: true })).toBe(true);
  });
  it("le poste occupé est obligatoire", () => {
    expect(erreursEnrolement({ ...base, poste: " " })).toContain("Le poste occupé est obligatoire.");
  });
  it("un mot de passe court est refusé", () => {
    expect(erreursEnrolement({ ...base, motDePasse: "abc1" }).length).toBe(1);
    expect(erreursEnrolement(base)).toEqual([]);
  });
  it("le jeton est haché en SHA-256", async () => {
    expect(await hacherJeton("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
