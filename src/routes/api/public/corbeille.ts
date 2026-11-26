import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { CORBEILLE_JOURS, PDF_BUCKET, estPurgeDue, type Convention } from "@/lib/conventions";

const SUPABASE_URL = "https://yebrrcwlewbktsvggfrx.supabase.co";

function jetonValide(request: Request, secret: string): boolean {
  const recu = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(recu);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function purger(request: Request) {
  const secret = process.env["ALERTES_CRON_SECRET"] || process.env["CRON_SECRET"];
  if (!secret) return Response.json({ error: "Planification non configurée" }, { status: 503 });
  if (!jetonValide(request, secret)) return new Response("Unauthorized", { status: 401 });
  if (new URL(request.url).search) return Response.json({ error: "Paramètres non autorisés" }, { status: 400 });
  const serviceKey = process.env["DCOP_SUPABASE_SERVICE_ROLE_KEY"];
  if (!serviceKey) return Response.json({ error: "Service de purge non configuré" }, { status: 503 });

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

  const maintenant = Date.now();
  const limite = new Date(maintenant - CORBEILLE_JOURS * 86_400_000).toISOString();
  const { data, error } = await db
    .from("conventions")
    .select("id,pdf_path,supprime_le")
    .not("supprime_le", "is", null)
    .lte("supprime_le", limite)
    .limit(100);
  if (error) return Response.json({ error: "Lecture de la corbeille impossible" }, { status: 500 });

  let supprimees = 0;
  let erreurs = 0;
  for (const c of (data ?? []) as Pick<Convention, "id" | "pdf_path" | "supprime_le">[]) {
    // Seconde vérification métier : aucune convention de moins de 30 jours ne peut partir.
    if (!estPurgeDue(c, maintenant)) continue;
    if (c.pdf_path) {
      const { error: pdfError } = await db.storage.from(PDF_BUCKET).remove([c.pdf_path]);
      if (pdfError) {
        erreurs += 1;
        continue;
      }
    }
    const { error: deleteError } = await db.from("conventions").delete().eq("id", c.id).eq("supprime_le", c.supprime_le);
    if (deleteError) erreurs += 1;
    else supprimees += 1;
  }
  return Response.json({ supprimees, erreurs }, { status: !erreurs ? 200 : supprimees ? 207 : 503 });
}

export const Route = createFileRoute("/api/public/corbeille")({
  server: {
    handlers: {
      POST: ({ request }) => purger(request),
    },
  },
});
