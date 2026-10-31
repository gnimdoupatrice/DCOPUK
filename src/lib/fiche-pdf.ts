// Fiche officielle A4 d'une convention (jsPDF), chargée à la demande côté navigateur.
import { STATUT_INFO, formatDate, statutConvention, type Convention } from "@/lib/conventions";
import { budgetEnFcfa, formatMontant, type ConventionProjet, type PointFocal } from "@/lib/projets";

export async function telechargerFichePdf(c: Convention, points: PointFocal[], projets: ConventionProjet[]) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const bleu: [number, number, number] = [34, 62, 164];

  doc.setFillColor(...bleu);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("Université de Kara — DCOP", 14, 12);
  doc.setFontSize(10);
  doc.text("Fiche officielle de convention", 14, 20);
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(13);
  doc.text(c.partenaire_nom, 14, 38);

  autoTable(doc, {
    startY: 43,
    theme: "grid",
    headStyles: { fillColor: bleu },
    head: [["Rubrique", "Valeur"]],
    body: [
      ["Pôle", c.pole],
      ["Cadre juridique", c.cadre_juridique],
      ["Pays / Ville", [c.partenaire_pays, c.partenaire_ville].filter(Boolean).join(" / ")],
      ["Thématique", c.thematique || "—"],
      ["Date de signature", formatDate(c.date_signature)],
      ["Durée", `${c.duree_mois} mois`],
      ["Date d'échéance", formatDate(c.date_echeance)],
      ["Préavis", c.preavis_mois == null ? "Non renseigné" : `${c.preavis_mois} mois`],
      ["Reconduction", c.reconduction],
      ["Alerte", c.date_alerte ? `${formatDate(c.date_alerte)} à ${c.heure_alerte ?? ""}` : "—"],
      ["E-mails d'alerte", (c.emails_alerte ?? []).join(", ") || "—"],
      ["Statut", STATUT_INFO[statutConvention(c)].label],
    ],
  });

  const y1 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFontSize(11);
  doc.text("Points focaux", 14, y1);
  autoTable(doc, {
    startY: y1 + 3,
    theme: "striped",
    headStyles: { fillColor: bleu },
    head: [["Institution", "Nom & prénom", "Fonction", "E-mail", "Téléphone"]],
    body: points.length
      ? points.map((p) => [p.institution_type === "universite" ? "Université de Kara" : "Partenaire", `${p.nom} ${p.prenom}`, p.fonction ?? "", p.email ?? "", p.telephone ?? ""])
      : [["—", "Aucun point focal", "", "", ""]],
  });

  const y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.text("Projets & réalisations", 14, y2);
  const total = projets.reduce((s, p) => s + budgetEnFcfa(p), 0);
  autoTable(doc, {
    startY: y2 + 3,
    theme: "striped",
    headStyles: { fillColor: bleu },
    head: [["Intitulé", "Période", "Budget", "Équiv. FCFA"]],
    body: projets.length
      ? projets.map((p) => [
          p.titre,
          [p.date_debut && formatDate(p.date_debut), p.date_fin && formatDate(p.date_fin)].filter(Boolean).join(" → ") || "—",
          p.budget_montant != null ? formatMontant(p.budget_montant, p.budget_devise ?? "FCFA") : "—",
          formatMontant(budgetEnFcfa(p)),
        ])
      : [["Aucun projet", "", "", ""]],
    ...(projets.length ? { foot: [["Total", "", "", formatMontant(total)]] } : {}),
  });

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, 14, 290);
  doc.save(`convention_${c.partenaire_nom.replace(/[^\w]+/g, "_")}.pdf`);
}
