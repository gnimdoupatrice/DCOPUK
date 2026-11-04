import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "node:crypto";
import { EchecEnvoi, PLAFOND_EMAILS_PAR_PASSAGE, destinatairesConvention, envoyerDestinataires, evenementEmailDu, motifErreurClair, receiptClos, type ConventionEmail, type ReceiptEnvoi, type TypeEmailAlerte } from "@/lib/alertes-email";
import { type PointFocal } from "@/lib/projets";

const SUPABASE_URL = "https://yebrrcwlewbktsvggfrx.supabase.co";
const RESEND_URL = "https://api.resend.com/emails";
const DIRECTION_PAR_DEFAUT = "beyeliakougnimdoupatrice13@gmail.com";

function jetonValide(request: Request, secret: string): boolean {
  const recu = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(recu);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const fmt = (d: Date) =>
  d.toLocaleString("fr-FR", { timeZone: "Africa/Lome", dateStyle: "long", timeStyle: "short" });

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] ?? ch);

async function envoyer(c: ConventionEmail, type: TypeEmailAlerte, moment: Date, email: string, apiKey: string, from: string, now: Date) {
  const titre = type === "alerte" ? "Alerte convention — heure programmée" : "Rappel — fin du report d'alerte";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px">
      <h2 style="color:#223ea4">${titre}</h2>
      <p><strong>${esc(c.partenaire_nom)}</strong> (${esc(c.partenaire_pays)})</p>
      <p>${esc(c.pole)} — ${esc(c.cadre_juridique)}</p>
      <p>Échéance : <strong>${new Date(c.date_echeance + "T00:00:00").toLocaleDateString("fr-FR")}</strong>
         (J-${Math.ceil((Date.parse(c.date_echeance + "T00:00:00Z") - now.getTime()) / 86400000)})</p>
      <p>Heure de l'alerte : ${fmt(moment)}</p>
      <p>Connectez-vous à l'Espace Privé DCOP pour reporter ou arrêter définitivement cette alerte.</p>
    </div>`;
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Idempotency-Key": createHash("sha256").update(`${c.id}:${type}:${moment.toISOString()}:${email}`).digest("hex"),
    },
    body: JSON.stringify({ from, to: [email], subject: `${titre} : ${c.partenaire_nom}`, html }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => {
    throw new EchecEnvoi(null);
  });
  if (!res.ok) throw new EchecEnvoi(res.status);
}

async function traiter(request: Request) {
  const secret = process.env["ALERTES_CRON_SECRET"];
  if (!secret) return Response.json({ error: "Configuration incomplète" }, { status: 503 });
  if (!jetonValide(request, secret)) return new Response("Unauthorized", { status: 401 });
  if (new URL(request.url).search) return Response.json({ error: "Paramètres non autorisés" }, { status: 400 });
  const serviceKey = process.env["DCOP_SUPABASE_SERVICE_ROLE_KEY"];
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM_EMAIL"];
  const directionEnv = (process.env["DCOP_DIRECTION_EMAIL"] ?? "").trim().toLowerCase();
  const DESTINATAIRE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(directionEnv) ? directionEnv : DIRECTION_PAR_DEFAUT;
  if (!serviceKey || !apiKey || !from || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from) || from.toLowerCase().endsWith("@resend.dev")) {
    return Response.json({ error: "Configuration d’envoi incomplète : adresse d’expédition sur un domaine vérifié requise" }, { status: 503 });
  }

  const db = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (serviceKey.startsWith("sb_")) headers.delete("authorization");
        headers.set("apikey", serviceKey);
        return fetch(input, { ...init, headers });
      },
    },
  });
  const { data, error } = await db
    .from("conventions")
    .select("*")
    .eq("archived", false)
    .is("alarme_arretee_le", null);
  if (error) return Response.json({ error: "Lecture des conventions impossible" }, { status: 500 });

  const now = new Date();
  const dues = ((data ?? []) as ConventionEmail[]).flatMap((c) => {
    const evenement = evenementEmailDu(c, now);
    return evenement ? [{ c, evenement }] : [];
  });
  if (!dues.length) return Response.json({ envoyes: 0, erreurs: 0 });
  const ids = dues.map(({ c }) => c.id);
  const [focaux, receipts] = await Promise.all([
    db.from("convention_points_focaux").select("convention_id,email,recoit_alertes").in("convention_id", ids).eq("recoit_alertes", true),
    db.from("convention_email_envois").select("convention_id,type_evenement,moment_evenement,destinataire,statut,definitif,tentatives").in("convention_id", ids),
  ]);
  if (focaux.error || receipts.error) return Response.json({ error: "Lecture des destinataires impossible : vérifier le script de mise à jour" }, { status: 500 });
  let envoyes = 0;
  let erreurs = 0;
  const lignes = (receipts.data ?? []) as ReceiptEnvoi[];
  for (const { c, evenement } of dues) {
    const budget = PLAFOND_EMAILS_PAR_PASSAGE - envoyes - erreurs;
    if (budget <= 0) break;
    try {
      const destinataires = destinatairesConvention(DESTINATAIRE, c, (focaux.data ?? []) as Pick<PointFocal, "convention_id" | "email" | "recoit_alertes">[]);
      const duMoment = lignes.filter((r) => r.convention_id === c.id && r.type_evenement === evenement.type && new Date(r.moment_evenement).toISOString() === evenement.cle);
      const dejaEnvoyes = new Set<string>(duMoment.filter(receiptClos).map((r) => r.destinataire));
      const cle = { convention_id: c.id, type_evenement: evenement.type, moment_evenement: evenement.cle };
      // Les anciens marqueurs ne concernaient que la Direction, jamais les partenaires.
      const ancien = evenement.type === "alerte" ? c.email_alerte_envoye_pour : c.email_report_envoye_pour;
      if (ancien && new Date(ancien).toISOString() === evenement.cle) dejaEnvoyes.add(DESTINATAIRE);
      const result = await envoyerDestinataires(destinataires, dejaEnvoyes,
        (email) => envoyer(c, evenement.type, evenement.moment, email, apiKey, `DCOP Université de Kara <${from}>`, now),
        async (email) => {
          const { error: receiptError } = await db.from("convention_email_envois").upsert({ ...cle, destinataire: email, statut: "envoye", motif_erreur: null, definitif: false, envoye_le: new Date().toISOString() }, { onConflict: "convention_id,type_evenement,moment_evenement,destinataire" });
          if (receiptError) throw new Error("Mémorisation impossible");
        },
        async (email, err) => {
          const { motif, definitif } = motifErreurClair(err instanceof EchecEnvoi ? err.statutHttp : null);
          const precedent = duMoment.find((r) => r.destinataire === email);
          await db.from("convention_email_envois").upsert({ ...cle, destinataire: email, statut: "echec", motif_erreur: motif, definitif, tentatives: (precedent?.tentatives ?? 0) + 1, envoye_le: new Date().toISOString() }, { onConflict: "convention_id,type_evenement,moment_evenement,destinataire" });
        },
        budget);
      envoyes += result.envoyes;
      erreurs += result.erreurs;
      if (destinataires.every((email) => dejaEnvoyes.has(email))) {
        const field = evenement.type === "alerte" ? "email_alerte_envoye_pour" : "email_report_envoye_pour";
        const { error: updateError } = await db.from("conventions").update({ [field]: evenement.cle }).eq("id", c.id);
        if (updateError) erreurs += 1;
      }
    } catch {
      erreurs += 1;
    }
  }
  return Response.json({ envoyes, erreurs }, { status: erreurs ? 503 : 200 });
}

export const Route = createFileRoute("/api/public/alertes-email")({
  server: {
    handlers: {
      POST: ({ request }) => traiter(request),
    },
  },
});
