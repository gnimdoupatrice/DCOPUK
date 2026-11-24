import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { erreursEnrolement, hacherJeton, invitationUtilisable, type Enrolement } from "@/lib/equipe";

const SUPABASE_URL = "https://yebrrcwlewbktsvggfrx.supabase.co";

function admin(serviceKey: string) {
  return createClient(SUPABASE_URL, serviceKey, {
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
}

const s = (v: unknown, max = 120) => (typeof v === "string" ? v.slice(0, max) : "");

async function traiter(request: Request) {
  const serviceKey = process.env["DCOP_SUPABASE_SERVICE_ROLE_KEY"];
  if (!serviceKey) return Response.json({ error: "Service d’enrôlement non configuré." }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  const jeton = s(body["jeton"], 100);
  if (jeton.length < 30) return Response.json({ error: "Lien d’invitation invalide." }, { status: 400 });
  const db = admin(serviceKey);
  const hash = await hacherJeton(jeton);
  const { data: inv } = await db.from("dcop_invitations").select("id, expire_le, utilisee_le, revoquee").eq("jeton_hash", hash).maybeSingle();
  if (!inv || !invitationUtilisable(inv)) {
    return Response.json({ error: "Ce lien d’invitation est invalide, expiré ou déjà utilisé." }, { status: 410 });
  }
  if (body["action"] === "verifier") return Response.json({ valide: true });

  const e: Enrolement = {
    nom: s(body["nom"]).trim(), prenom: s(body["prenom"]).trim(), poste: s(body["poste"]).trim(),
    pole: s(body["pole"]).trim(), telephone: s(body["telephone"], 30).trim(),
    email: s(body["email"], 200).trim().toLowerCase(), motDePasse: s(body["motDePasse"], 200),
  };
  const err = erreursEnrolement(e);
  if (err.length) return Response.json({ error: err.join(" ") }, { status: 400 });

  // Réservation atomique du lien (un seul usage, même en cas de double clic)
  const { data: pris } = await db.from("dcop_invitations").update({ utilisee_le: new Date().toISOString() })
    .eq("id", inv.id).is("utilisee_le", null).select("id");
  if (!pris?.length) return Response.json({ error: "Ce lien vient déjà d’être utilisé." }, { status: 410 });

  const { data: cree, error: errUser } = await db.auth.admin.createUser({ email: e.email, password: e.motDePasse, email_confirm: true });
  if (errUser || !cree.user) {
    await db.from("dcop_invitations").update({ utilisee_le: null }).eq("id", inv.id);
    const deja = /already|registered|exists/i.test(errUser?.message ?? "");
    return Response.json({ error: deja ? "Cette adresse e-mail possède déjà un compte." : "Création du compte impossible." }, { status: deja ? 409 : 500 });
  }
  const uid = cree.user.id;
  const r1 = await db.from("dcop_roles").insert({ user_id: uid, role: "agent", actif: false });
  const r2 = await db.from("dcop_profils").insert({ user_id: uid, email: e.email, nom: e.nom, prenom: e.prenom, poste: e.poste, pole: e.pole, telephone: e.telephone, invitation_id: inv.id });
  if (r1.error || r2.error) {
    await db.auth.admin.deleteUser(uid);
    await db.from("dcop_invitations").update({ utilisee_le: null }).eq("id", inv.id);
    return Response.json({ error: "Enregistrement du profil impossible." }, { status: 500 });
  }
  await db.from("dcop_invitations").update({ utilisee_par: uid }).eq("id", inv.id);
  return Response.json({ ok: true });
}

export const Route = createFileRoute("/api/public/enrolement")({
  server: { handlers: { POST: ({ request }) => traiter(request) } },
});
