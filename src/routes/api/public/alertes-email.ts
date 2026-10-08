import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { type Convention, joursRestants, momentAlerteConvention } from "@/lib/conventions";

const SUPABASE_URL = "https://yebrrcwlewbktsvggfrx.supabase.co";
const RESEND_URL = "https://api.resend.com/emails";
const DESTINATAIRE = "beyeliakougnimdoupatrice13@gmail.com";
const EXPEDITEUR = "DCOP Université de Kara <onboarding@resend.dev>";

type Row = Convention & {
  email_alerte_envoye_pour?: string | null;
  email_report_envoye_pour?: string | null;
};

function jetonValide(request: Request, secret: string): boolean {
  const recu = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(recu);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const fmt = (d: Date) =>
  d.toLocaleString("fr-FR", { timeZone: "Africa/Lome", dateStyle: "long", timeStyle: "short" });

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

async function envoyer(c: Row, type: "alerte" | "report", moment: Date) {
  const titre = type === "alerte" ? "Alerte convention — heure programmée" : "Rappel — fin du report d'alerte";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px">
      <h2 style="color:#223ea4">${titre}</h2>
      <p><strong>${esc(c.partenaire_nom)}</strong> (${esc(c.partenaire_pays)})</p>
      <p>${esc(c.pole)} — ${esc(c.cadre_juridique)}</p>
      <p>Échéance : <strong>${new Date(c.date_echeance + "T00:00:00").toLocaleDateString("fr-FR")}</strong>
         (J-${joursRestants(c.date_echeance)})</p>
      <p>Heure de l'alerte : ${fmt(moment)}</p>
      <p>Connectez-vous à l'Espace Privé DCOP pour reporter ou arrêter définitivement cette alerte.</p>
    </div>`;
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env["RESEND_API_KEY"]}`,
    },
    body: JSON.stringify({ from: EXPEDITEUR, to: [DESTINATAIRE], subject: `${titre} : ${c.partenaire_nom}`, html }),
  });
  if (!res.ok) throw new Error(`Resend [${res.status}] ${await res.text()}`);
}

async function traiter(request: Request) {
  const secret = process.env["ALERTES_CRON_SECRET"];
  const serviceKey = process.env["DCOP_SUPABASE_SERVICE_ROLE_KEY"];
  if (!secret || !serviceKey || !process.env["RESEND_API_KEY"]) {
    return Response.json({ error: "Configuration incomplète" }, { status: 500 });
  }
  if (!jetonValide(request, secret)) return new Response("Unauthorized", { status: 401 });

  const db = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db
    .from("conventions")
    .select("*")
    .eq("archived", false)
    .is("alarme_arretee_le", null);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const envoyes: string[] = [];
  const erreurs: string[] = [];
  for (const c of (data ?? []) as Row[]) {
    if (joursRestants(c.date_echeance) < 0) continue;
    try {
      if (c.alarme_reportee_jusqu_a) {
        const r = new Date(c.alarme_reportee_jusqu_a);
        const cle = r.toISOString();
        if (r.getTime() <= now && c.email_report_envoye_pour !== cle) {
          await envoyer(c, "report", r);
          await db.from("conventions").update({ email_report_envoye_pour: cle }).eq("id", c.id);
          envoyes.push(c.id);
        }
      } else {
        const m = momentAlerteConvention(c);
        if (!m) continue;
        const cle = m.toISOString();
        if (m.getTime() <= now && c.email_alerte_envoye_pour !== cle) {
          await envoyer(c, "alerte", m);
          await db.from("conventions").update({ email_alerte_envoye_pour: cle }).eq("id", c.id);
          envoyes.push(c.id);
        }
      }
    } catch (e) {
      console.error("Envoi e-mail échoué", c.id, e);
      erreurs.push(c.id);
    }
  }
  return Response.json({ envoyes: envoyes.length, erreurs: erreurs.length });
}

export const Route = createFileRoute("/api/public/alertes-email")({
  server: {
    handlers: {
      POST: ({ request }) => traiter(request),
    },
  },
});
