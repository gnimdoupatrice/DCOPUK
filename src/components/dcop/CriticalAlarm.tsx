import { useEffect, useMemo, useRef, useState } from "react";
import { AlarmClock, AlertTriangle, BellRing, BellOff, ChevronDown, ChevronUp } from "lucide-react";
import {
  type Convention,
  SEUIL_ALERTE_JOURS,
  SEUIL_URGENCE_JOURS,
  dateLimitePreavis,
  formatDate,
  joursRestants,
} from "@/lib/conventions";

/** Fichier audio personnalisé optionnel (déposer public/alarme.mp3). Repli : synthèse Web Audio. */
const AUDIO_PERSO = "/alarme.mp3";
const NB_SONNERIES = 3;
const BIPS_PAR_SONNERIE = 5;
const STORE_KEY = "dcop_alarme_etat";

const SNOOZE_OPTIONS = [
  { id: "15m", label: "15 min" },
  { id: "1h", label: "1 heure" },
  { id: "3h", label: "3 heures" },
  { id: "demain", label: "Demain 8h" },
] as const;
type SnoozeId = (typeof SNOOZE_OPTIONS)[number]["id"];

function snoozeVers(id: SnoozeId): number {
  const now = Date.now();
  if (id === "15m") return now + 15 * 60_000;
  if (id === "1h") return now + 60 * 60_000;
  if (id === "3h") return now + 3 * 60 * 60_000;
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d.getTime();
}

/** Convention active, non expirée, sous le seuil J-150, en zone rouge ou préavis atteint. */
export function estCritique(c: Convention): boolean {
  if (c.archived) return false;
  const j = joursRestants(c.date_echeance);
  if (j < 0) return false;
  const preavis = dateLimitePreavis(c.date_echeance, c.preavis_mois);
  const preavisAtteint = !!preavis && joursRestants(preavis) <= 0;
  return j <= SEUIL_ALERTE_JOURS || preavisAtteint;
}

/** Joue NB_SONNERIES sonneries puis appelle onFin. */
class Sirene {
  private ctx: AudioContext | null = null;
  private timers: number[] = [];
  private audio: HTMLAudioElement | null = null;
  private actif = false;

  async jouer(onFin: () => void) {
    this.stop();
    this.actif = true;
    try {
      const head = await fetch(AUDIO_PERSO, { method: "HEAD" });
      if (head.ok && (head.headers.get("content-type") ?? "").startsWith("audio")) {
        let n = 0;
        const a = new Audio(AUDIO_PERSO);
        this.audio = a;
        a.onended = () => {
          n += 1;
          if (!this.actif) return;
          if (n >= NB_SONNERIES) {
            this.stop();
            onFin();
          } else void a.play().catch(() => {});
        };
        await a.play().catch(() => {});
        return;
      }
    } catch {
      /* repli synthèse */
    }
    if (!this.actif) return;
    this.synth(onFin);
  }

  private synth(onFin: () => void) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
    // Sonnerie = 5 bips espacés de 1,2 s ; pause de 2,5 s entre sonneries
    const dureeSonnerie = BIPS_PAR_SONNERIE * 1200 + 2500;
    for (let r = 0; r < NB_SONNERIES; r++) {
      for (let b = 0; b < BIPS_PAR_SONNERIE; b++) {
        this.timers.push(window.setTimeout(bip, r * dureeSonnerie + b * 1200));
      }
    }
    this.timers.push(
      window.setTimeout(() => {
        this.stop();
        onFin();
      }, NB_SONNERIES * dureeSonnerie),
    );
  }

  resume() {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
    if (this.audio?.paused) void this.audio.play().catch(() => {});
  }

  stop() {
    this.actif = false;
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    if (this.audio) {
      this.audio.onended = null;
      this.audio.pause();
      this.audio = null;
    }
  }
}

interface EtatStocke {
  signature: string;
  ackJour?: string;
  snoozeJusqua?: number;
}

function lireEtat(): EtatStocke | null {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "null");
  } catch {
    return null;
  }
}
function ecrireEtat(e: EtatStocke) {
  localStorage.setItem(STORE_KEY, JSON.stringify(e));
}
const aujourdhui = () => new Date().toISOString().slice(0, 10);

function formatDecompte(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h > 0 ? `${h} h ` : ""}${String(m).padStart(2, "0")} min ${String(sec).padStart(2, "0")} s`;
}

type Phase = "repos" | "sonne" | "snooze";

export function CriticalAlarm({ conventions }: { conventions: Convention[] }) {
  const [now, setNow] = useState(() => Date.now());
  const [phase, setPhase] = useState<Phase>("repos");
  const [snoozeJusqua, setSnoozeJusqua] = useState<number | null>(null);
  const [choix, setChoix] = useState<SnoozeId>("3h");
  const [details, setDetails] = useState(true);
  const [autoArret, setAutoArret] = useState(false);
  const sirene = useRef<Sirene | null>(null);

  // Horloge : 1 s (décompte), la surveillance des conventions en découle
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const minute = Math.floor(now / 60_000);

  const critiques = useMemo(
    () =>
      conventions
        .filter(estCritique)
        .sort((a, b) => joursRestants(a.date_echeance) - joursRestants(b.date_echeance)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conventions, minute],
  );
  const signature = critiques.map((c) => `${c.id}:${c.date_echeance}`).join("|");

  function sonner() {
    if (!sirene.current) sirene.current = new Sirene();
    setAutoArret(false);
    setPhase("sonne");
    void sirene.current.jouer(() => {
      // 3 sonneries sans interaction → rappel automatique dans 3 h
      const t = snoozeVers("3h");
      ecrireEtat({ signature, snoozeJusqua: t });
      setSnoozeJusqua(t);
      setAutoArret(true);
      setPhase("snooze");
    });
  }

  // Décision : sonner, rester en rappel, ou rien
  useEffect(() => {
    if (!signature) {
      sirene.current?.stop();
      setPhase("repos");
      return;
    }
    if (phase === "sonne") return;
    const etat = lireEtat();
    const memeAlerte = etat?.signature === signature;
    if (memeAlerte && etat?.ackJour === aujourdhui()) {
      if (phase !== "repos") setPhase("repos");
      return;
    }
    if (memeAlerte && etat?.snoozeJusqua && etat.snoozeJusqua > now) {
      if (phase !== "snooze") {
        setSnoozeJusqua(etat.snoozeJusqua);
        setPhase("snooze");
      }
      return;
    }
    sonner();
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

  function repeter() {
    sirene.current?.stop();
    const t = snoozeVers(choix);
    ecrireEtat({ signature, snoozeJusqua: t });
    setSnoozeJusqua(t);
    setAutoArret(false);
    setPhase("snooze");
  }

  function arreterDefinitivement() {
    sirene.current?.stop();
    ecrireEtat({ signature, ackJour: aujourdhui() });
    setSnoozeJusqua(null);
    setPhase("repos");
  }

  if (phase === "repos" || critiques.length === 0) return null;
  const n = critiques.length;

  const resume = (
    <div className="space-y-3 text-sm text-foreground">
      <p>
        {n} convention{n > 1 ? "s actives sont" : " active est"} sous le seuil de veille (J-
        {SEUIL_ALERTE_JOURS}), en zone critique (&lt; {SEUIL_URGENCE_JOURS} jours) ou au-delà de la
        date limite de préavis. Une décision du Directeur est requise.
      </p>
      <ul className="space-y-2">
        {critiques.map((c) => {
          const j = joursRestants(c.date_echeance);
          const preavis = dateLimitePreavis(c.date_echeance, c.preavis_mois);
          const preavisAtteint = !!preavis && joursRestants(preavis) <= 0;
          const rouge = j < SEUIL_URGENCE_JOURS || preavisAtteint;
          return (
            <li key={c.id} className="rounded-lg border border-border bg-muted p-3">
              <p className="font-semibold text-uk-blue">
                {c.partenaire_nom}{" "}
                <span className="font-normal text-muted-foreground">({c.partenaire_pays})</span>
              </p>
              <p>
                Pôle : {c.pole} — Cadre : {c.cadre_juridique}
              </p>
              <p>
                Date limite : <strong>{formatDate(c.date_echeance)}</strong> —{" "}
                <strong className={rouge ? "text-destructive" : "text-uk-orange"}>
                  J - {j} jour{j > 1 ? "s" : ""}
                </strong>
                {preavis && <> — préavis au {formatDate(preavis)}</>}
              </p>
              <p className="mt-1 text-muted-foreground">
                Recommandation :{" "}
                {preavisAtteint
                  ? "le délai de préavis est atteint ; notifier sans délai le partenaire de la décision (reconduction ou dénonciation)."
                  : `engager la procédure de ${c.reconduction?.toLowerCase().includes("tacite") ? "confirmation ou dénonciation" : "renouvellement par avenant"} avant l'échéance.`}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );

  // Rappel programmé : pastille compacte avec décompte
  if (phase === "snooze" && snoozeJusqua) {
    return (
      <div className="fixed bottom-4 right-4 z-[60] w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <AlarmClock className="h-6 w-6 shrink-0 text-uk-blue" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-foreground">
              Rappel dans {formatDecompte(snoozeJusqua - now)}
            </p>
            <p className="text-muted-foreground">
              {autoArret ? "Alarme arrêtée après 3 sonneries. " : ""}
              {n} convention{n > 1 ? "s" : ""} concernée{n > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={sonner}
            className="flex-1 rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
          >
            Revoir l'alerte
          </button>
          <button
            onClick={arreterDefinitivement}
            className="flex-1 rounded-md bg-uk-blue px-3 py-2 text-xs font-semibold text-primary-foreground hover:brightness-110"
          >
            J'ai pris acte
          </button>
        </div>
      </div>
    );
  }

  // Alarme en cours : écran façon réveil de téléphone
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-foreground/40 p-3 backdrop-blur-sm sm:items-center">
      <div
        role="alertdialog"
        aria-live="assertive"
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border-2 border-destructive bg-card shadow-2xl"
      >
        <div className="flex flex-col items-center gap-1 bg-destructive px-4 py-5 text-center text-destructive-foreground">
          <BellRing className="h-10 w-10 animate-pulse" />
          <p className="text-3xl font-bold tabular-nums">
            {new Date(now).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="font-semibold">
            Alerte échéances — {n} convention{n > 1 ? "s" : ""}
          </p>
          <p className="text-xs opacity-90">
            {NB_SONNERIES} sonneries puis rappel automatique dans 3 h sans action de votre part
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <button
            onClick={() => setDetails((d) => !d)}
            className="mb-2 flex w-full items-center gap-2 text-sm font-semibold text-uk-blue"
          >
            <AlertTriangle className="h-4 w-4" /> Résumé de la situation
            {details ? <ChevronUp className="ml-auto h-4 w-4" /> : <ChevronDown className="ml-auto h-4 w-4" />}
          </button>
          {details && resume}
        </div>

        <div className="space-y-3 border-t border-border p-4">
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Répéter dans :</p>
            <div className="grid grid-cols-4 gap-2">
              {SNOOZE_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setChoix(o.id)}
                  className={`rounded-md border px-2 py-1.5 text-xs font-semibold ${
                    choix === o.id
                      ? "border-uk-blue bg-uk-blue text-primary-foreground"
                      : "border-border text-foreground hover:bg-muted"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={repeter}
              className="flex items-center justify-center gap-2 rounded-full border-2 border-uk-blue px-4 py-3 font-semibold text-uk-blue hover:bg-muted"
            >
              <AlarmClock className="h-5 w-5" /> Répéter
            </button>
            <button
              onClick={arreterDefinitivement}
              className="flex items-center justify-center gap-2 rounded-full bg-destructive px-4 py-3 font-semibold text-destructive-foreground hover:brightness-110"
            >
              <BellOff className="h-5 w-5" /> Arrêter définitivement
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            « Arrêter définitivement » consigne votre prise d'acte et stoppe les rappels pour aujourd'hui et ces échéances.
          </p>
        </div>
      </div>
    </div>
  );
}
