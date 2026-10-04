import { useEffect, useMemo, useRef, useState } from "react";
import { AlarmClock, AlertTriangle, Bell, BellRing, BellOff, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  type Convention,
  SEUIL_URGENCE_JOURS,
  dateLimitePreavis,
  formatDate,
  joursRestants,
  preavisAtteint,
  seuilDe,
} from "@/lib/conventions";

/** Fichier audio personnalisé optionnel (public/alarme.mp3). Repli : synthèse Web Audio. */
const AUDIO_PERSO = "/alarme.mp3";
const NB_SONNERIES = 3;
const DUREE_SONNERIE_MS = 20_000; // 3 × 20 s ≈ 1 minute
const HEURE_RAPPEL = 8; // deuxième alarme opérationnelle à 08:00:00
const STORE_KEY = "dcop_alarme_v2";

/** Convention active, non expirée, ayant atteint son seuil (personnalisé ou J-150) ou son préavis. */
export function estCritique(c: Convention): boolean {
  if (c.archived) return false;
  const j = joursRestants(c.date_echeance);
  if (j < 0) return false;
  return j <= seuilDe(c) || preavisAtteint(c);
}

function prochain8h(from = Date.now()): number {
  const d = new Date(from);
  d.setHours(HEURE_RAPPEL, 0, 0, 0);
  if (d.getTime() <= from) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/** Joue NB_SONNERIES sonneries de 20 s puis appelle onFin. */
class Sirene {
  private ctx: AudioContext | null = null;
  private timers: number[] = [];
  private audio: HTMLAudioElement | null = null;

  async jouer(onFin: () => void) {
    this.stop();
    this.timers.push(window.setTimeout(() => { this.stop(); onFin(); }, NB_SONNERIES * DUREE_SONNERIE_MS));
    try {
      const head = await fetch(AUDIO_PERSO, { method: "HEAD" });
      if (head.ok && (head.headers.get("content-type") ?? "").startsWith("audio")) {
        const a = new Audio(AUDIO_PERSO);
        a.loop = true;
        this.audio = a;
        // 15 s de son puis 5 s de pause par sonnerie
        for (let r = 0; r < NB_SONNERIES; r++) {
          this.timers.push(window.setTimeout(() => { a.currentTime = 0; void a.play().catch(() => {}); }, r * DUREE_SONNERIE_MS));
          this.timers.push(window.setTimeout(() => a.pause(), r * DUREE_SONNERIE_MS + 15_000));
        }
        return;
      }
    } catch { /* repli synthèse */ }
    this.synth();
  }

  private synth() {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    const bip = () => {
      const ctx = this.ctx;
      if (!ctx) return;
      if (ctx.state === "suspended") void ctx.resume();
      [0, 0.25, 0.5].forEach((t, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "square";
        o.frequency.value = i === 2 ? 1046.5 : 880;
        const s = ctx.currentTime + t;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(0.18, s + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, s + 0.2);
        o.connect(g).connect(ctx.destination);
        o.start(s);
        o.stop(s + 0.22);
      });
    };
    // Chaque sonnerie : bips toutes les 1,2 s pendant 15 s, puis 5 s de silence
    for (let r = 0; r < NB_SONNERIES; r++) {
      for (let t = 0; t < 15_000; t += 1200) {
        this.timers.push(window.setTimeout(bip, r * DUREE_SONNERIE_MS + t));
      }
    }
  }

  resume() {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  stop() {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    if (this.audio) { this.audio.pause(); this.audio = null; }
  }
}

interface EtatStocke {
  signature: string;
  acquitte?: boolean;
  prochaineAlarme?: number; // timestamp de la prochaine sonnerie
}
function lireEtat(): EtatStocke | null {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? "null"); } catch { return null; }
}
function ecrireEtat(e: EtatStocke) {
  localStorage.setItem(STORE_KEY, JSON.stringify(e));
}

async function notifierSysteme(titre: string, corps: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const opts: NotificationOptions = { body: corps, icon: "/icon-192.png", badge: "/icon-192.png", silent: true, tag: "dcop-alerte" };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(titre, opts);
    else new Notification(titre, opts);
  } catch { /* silencieux */ }
}

function formatDecompte(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h > 0 ? `${h} h ` : ""}${String(m).padStart(2, "0")} min ${String(s % 60).padStart(2, "0")} s`;
}

function toLocalInput(ts: number) {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}

type Phase = "repos" | "sonne" | "attente";

export function CriticalAlarm({ conventions }: { conventions: Convention[] }) {
  const [now, setNow] = useState(() => Date.now());
  const [phase, setPhase] = useState<Phase>("repos");
  const [prochaine, setProchaine] = useState<number | null>(null);
  const [details, setDetails] = useState(true);
  const [autoArret, setAutoArret] = useState(false);
  const [perso, setPerso] = useState(() => toLocalInput(Date.now() + 8 * 3600_000));
  const [permission, setPermission] = useState<NotificationPermission | "indisponible">(() =>
    typeof Notification === "undefined" ? "indisponible" : Notification.permission,
  );
  const sirene = useRef<Sirene | null>(null);
  const jourPrec = useRef(new Date().toDateString());

  // Surveillance chaque seconde (bascule 00:00:00 et 08:00:00 incluses)
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const jour = new Date(now).toDateString();

  const critiques = useMemo(
    () => conventions.filter(estCritique).sort((a, b) => joursRestants(a.date_echeance) - joursRestants(b.date_echeance)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conventions, jour],
  );
  const signature = critiques.map((c) => `${c.id}:${c.date_echeance}`).join("|");
  const n = critiques.length;

  function sonner() {
    if (!sirene.current) sirene.current = new Sirene();
    setAutoArret(false);
    setPhase("sonne");
    void sirene.current.jouer(() => {
      // Aucune interaction → mise en sommeil jusqu'à la prochaine alarme de 08:00
      const t = prochain8h();
      ecrireEtat({ signature, prochaineAlarme: t });
      setProchaine(t);
      setAutoArret(true);
      setPhase("attente");
    });
  }

  /** 00:00:00 ou première détection : notification discrète si l'appli est cachée, sinon sonnerie. */
  function declencher(nuit: boolean) {
    if (document.hidden || nuit) {
      void notifierSysteme(
        "DCOP — Alerte échéances",
        `${n} convention${n > 1 ? "s" : ""} à traiter. Rappel sonore à ${HEURE_RAPPEL}h00.`,
      );
    }
    if (document.hidden) {
      const t = prochain8h();
      ecrireEtat({ signature, prochaineAlarme: t });
      setProchaine(t);
      setPhase("attente");
      return;
    }
    sonner();
  }

  useEffect(() => {
    const nouveauJour = jourPrec.current !== jour;
    jourPrec.current = jour;
    if (!signature) {
      sirene.current?.stop();
      setPhase("repos");
      return;
    }
    if (phase === "sonne") return;
    const etat = lireEtat();
    const meme = etat?.signature === signature;
    if (meme && etat?.acquitte) {
      if (phase !== "repos") setPhase("repos");
      return;
    }
    if (meme && etat?.prochaineAlarme) {
      if (etat.prochaineAlarme > now) {
        if (phase !== "attente" || prochaine !== etat.prochaineAlarme) {
          setProchaine(etat.prochaineAlarme);
          setPhase("attente");
        }
        return;
      }
      // Heure de rappel atteinte (08:00 ou report) : sonnerie active + notification si cachée
      if (document.hidden) void notifierSysteme("DCOP — Rappel d'échéances", `${n} convention${n > 1 ? "s" : ""} en attente de décision.`);
      sonner();
      return;
    }
    // Nouvelle alerte (seuil franchi à 00:00:00 ou à l'ouverture)
    declencher(nouveauJour && new Date(now).getHours() < HEURE_RAPPEL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, now, phase]);

  // Autoplay bloqué : la première interaction relance le son
  useEffect(() => {
    if (phase !== "sonne") return;
    const unlock = () => sirene.current?.resume();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [phase]);

  useEffect(() => () => sirene.current?.stop(), []);

  async function demanderAutorisations() {
    if (typeof Notification === "undefined") return;
    setPermission(await Notification.requestPermission());
  }

  function reporter(t: number) {
    if (!Number.isFinite(t) || t <= Date.now()) return;
    sirene.current?.stop();
    ecrireEtat({ signature, prochaineAlarme: t });
    setProchaine(t);
    setAutoArret(false);
    setPhase("attente");
  }

  async function arreterDefinitivement() {
    sirene.current?.stop();
    ecrireEtat({ signature, acquitte: true });
    setProchaine(null);
    setPhase("repos");
    const note = `Prise d'acte du Directeur le ${new Date().toLocaleString("fr-FR")} — rappels arrêtés pour cette échéance.`;
    await supabase
      .from("convention_historique")
      .insert(critiques.map((c) => ({ convention_id: c.id, action: "Alerte acquittée définitivement", note })));
  }

  const bandeauPermission =
    permission === "default" ? (
      <button
        onClick={demanderAutorisations}
        className="fixed bottom-4 left-4 z-[55] flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-uk-blue shadow-lg hover:bg-muted"
      >
        <Bell className="h-4 w-4" /> Autoriser les notifications d'alerte
      </button>
    ) : null;

  if (phase === "repos" || n === 0) return bandeauPermission;

  const resume = (
    <div className="space-y-3 text-sm text-foreground">
      <p>
        {n} convention{n > 1 ? "s actives ont" : " active a"} atteint leur seuil d'alerte (personnalisé ou J-150), la zone
        critique (&lt; {SEUIL_URGENCE_JOURS} jours) ou la date limite de préavis. Une décision du Directeur est requise.
      </p>
      <ul className="space-y-2">
        {critiques.map((c) => {
          const j = joursRestants(c.date_echeance);
          const preavis = dateLimitePreavis(c.date_echeance, c.preavis_mois);
          const pa = preavisAtteint(c);
          const rouge = j < SEUIL_URGENCE_JOURS || pa;
          return (
            <li key={c.id} className="rounded-lg border border-border bg-muted p-3">
              <p className="font-semibold text-uk-blue">
                {c.partenaire_nom} <span className="font-normal text-muted-foreground">({c.partenaire_pays})</span>
              </p>
              <p>Pôle : {c.pole} — Cadre : {c.cadre_juridique}</p>
              <p>
                Date limite : <strong>{formatDate(c.date_echeance)}</strong> —{" "}
                <strong className={rouge ? "text-destructive" : "text-uk-orange"}>J - {j} jour{j > 1 ? "s" : ""}</strong>
                {preavis && <> — préavis au {formatDate(preavis)}</>}
              </p>
              <p className="mt-1 text-muted-foreground">
                Recommandation :{" "}
                {pa
                  ? "le délai de préavis est atteint ; notifier sans délai le partenaire de la décision (reconduction ou dénonciation)."
                  : `engager la procédure de ${c.reconduction?.toLowerCase().includes("tacite") ? "confirmation ou dénonciation" : "renouvellement par avenant"} avant l'échéance.`}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );

  if (phase === "attente" && prochaine) {
    return (
      <>
        {bandeauPermission}
        <div className="fixed bottom-4 right-4 z-[60] w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 shadow-xl">
          <div className="flex items-center gap-3">
            <AlarmClock className="h-6 w-6 shrink-0 text-uk-blue" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-foreground">Prochaine alarme dans {formatDecompte(prochaine - now)}</p>
              <p className="text-muted-foreground">
                {new Date(prochaine).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                {autoArret ? " — mise en sommeil après 3 sonneries" : ""} · {n} convention{n > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={sonner} className="flex-1 rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted">
              Revoir l'alerte
            </button>
            <button onClick={arreterDefinitivement} className="flex-1 rounded-md bg-uk-blue px-3 py-2 text-xs font-semibold text-primary-foreground hover:brightness-110">
              Arrêter définitivement
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-foreground/40 p-3 backdrop-blur-sm sm:items-center">
      <div role="alertdialog" aria-live="assertive" className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border-2 border-destructive bg-card shadow-2xl">
        <div className="flex flex-col items-center gap-1 bg-destructive px-4 py-5 text-center text-destructive-foreground">
          <BellRing className="h-10 w-10 animate-pulse" />
          <p className="text-3xl font-bold tabular-nums">
            {new Date(now).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="font-semibold">Alerte échéances — {n} convention{n > 1 ? "s" : ""}</p>
          <p className="text-xs opacity-90">3 sonneries (~1 min) puis mise en sommeil jusqu'à {HEURE_RAPPEL}h00 sans action</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <button onClick={() => setDetails((d) => !d)} className="mb-2 flex w-full items-center gap-2 text-sm font-semibold text-uk-blue">
            <AlertTriangle className="h-4 w-4" /> Résumé de la situation
            {details ? <ChevronUp className="ml-auto h-4 w-4" /> : <ChevronDown className="ml-auto h-4 w-4" />}
          </button>
          {details && resume}
        </div>

        <div className="space-y-3 border-t border-border p-4">
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Reporter l'alarme (Snooze) :</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => reporter(Date.now() + 8 * 3600_000)} className="flex items-center justify-center gap-2 rounded-full border-2 border-uk-blue px-3 py-2 text-sm font-semibold text-uk-blue hover:bg-muted">
                <AlarmClock className="h-4 w-4" /> +8 heures
              </button>
              <button onClick={() => reporter(prochain8h())} className="flex items-center justify-center gap-2 rounded-full border-2 border-uk-blue px-3 py-2 text-sm font-semibold text-uk-blue hover:bg-muted">
                <AlarmClock className="h-4 w-4" /> Prochain 8h00
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="datetime-local"
                value={perso}
                min={toLocalInput(Date.now())}
                onChange={(e) => setPerso(e.target.value)}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <button onClick={() => reporter(new Date(perso).getTime())} className="rounded-md border border-uk-blue px-3 py-2 text-xs font-semibold text-uk-blue hover:bg-muted">
                Reporter
              </button>
            </div>
          </div>
          <button onClick={arreterDefinitivement} className="flex w-full items-center justify-center gap-2 rounded-full bg-destructive px-4 py-3 font-semibold text-destructive-foreground hover:brightness-110">
            <BellOff className="h-5 w-5" /> Arrêter définitivement
          </button>
          <p className="text-center text-xs text-muted-foreground">
            « Arrêter définitivement » consigne votre prise d'acte dans l'historique et annule l'alarme de {HEURE_RAPPEL}h00 pour ces échéances.
          </p>
        </div>
      </div>
    </div>
  );
}
