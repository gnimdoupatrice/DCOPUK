import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BellRing } from "lucide-react";
import {
  type Convention,
  SEUIL_URGENCE_JOURS,
  dateLimitePreavis,
  formatDate,
  joursRestants,
} from "@/lib/conventions";

/** Fichier audio personnalisé optionnel (déposer public/alarme.mp3). Repli : synthèse Web Audio. */
const AUDIO_PERSO = "/alarme.mp3";

/** Convention active, non expirée, en zone rouge (< 60 j) ou dont le préavis est atteint. */
export function estCritique(c: Convention): boolean {
  if (c.archived) return false;
  const j = joursRestants(c.date_echeance);
  if (j < 0) return false;
  const preavis = dateLimitePreavis(c.date_echeance, c.preavis_mois);
  const preavisAtteint = !!preavis && joursRestants(preavis) <= 0;
  return j < SEUIL_URGENCE_JOURS || preavisAtteint;
}

class Sirene {
  private ctx: AudioContext | null = null;
  private timer: number | null = null;
  private audio: HTMLAudioElement | null = null;

  async start() {
    if (this.timer || this.audio) return;
    try {
      const head = await fetch(AUDIO_PERSO, { method: "HEAD" });
      if (head.ok && (head.headers.get("content-type") ?? "").startsWith("audio")) {
        const a = new Audio(AUDIO_PERSO);
        a.loop = true;
        await a.play();
        this.audio = a;
        return;
      }
    } catch {
      /* repli synthèse */
    }
    this.startSynth();
  }

  private startSynth() {
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
    bip();
    this.timer = window.setInterval(bip, 1400);
  }

  /** Débloque l'audio si le navigateur a bloqué la lecture automatique. */
  resume() {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
    if (this.audio?.paused) void this.audio.play().catch(() => {});
  }

  stop() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
  }
}

const ACK_KEY = "dcop_alarme_ack";

export function CriticalAlarm({ conventions }: { conventions: Convention[] }) {
  const [tick, setTick] = useState(0);
  const [ringing, setRinging] = useState(false);
  const [open, setOpen] = useState(false);
  const sirene = useRef<Sirene | null>(null);

  // Surveillance périodique toutes les 60 s
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const critiques = useMemo(
    () =>
      conventions
        .filter(estCritique)
        .sort((a, b) => joursRestants(a.date_echeance) - joursRestants(b.date_echeance)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conventions, tick],
  );
  const signature = critiques.map((c) => `${c.id}:${c.date_echeance}`).join("|");

  useEffect(() => {
    if (!signature || open) return;
    const jour = new Date().toISOString().slice(0, 10);
    if (sessionStorage.getItem(ACK_KEY) === `${jour}#${signature}`) return;
    if (!sirene.current) sirene.current = new Sirene();
    void sirene.current.start();
    setRinging(true);
  }, [signature, open]);

  // Si l'autoplay est bloqué, la première interaction relance le son
  useEffect(() => {
    if (!ringing) return;
    const unlock = () => sirene.current?.resume();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [ringing]);

  useEffect(() => () => sirene.current?.stop(), []);

  function arreter() {
    sirene.current?.stop();
    setRinging(false);
    setOpen(true);
  }

  function prendreActe() {
    const jour = new Date().toISOString().slice(0, 10);
    sessionStorage.setItem(ACK_KEY, `${jour}#${signature}`);
    setOpen(false);
  }

  if (!ringing && !open) return null;
  const n = critiques.length;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex justify-center p-3">
      <div
        role="alertdialog"
        aria-live="assertive"
        className="w-full max-w-2xl overflow-hidden rounded-xl border-2 border-destructive bg-card shadow-2xl"
      >
        {!open ? (
          <button
            onClick={arreter}
            className="flex w-full animate-pulse items-center gap-3 bg-destructive px-4 py-4 text-left text-destructive-foreground"
          >
            <BellRing className="h-7 w-7 shrink-0" />
            <span className="flex-1">
              <span className="block font-bold">
                ALERTE CRITIQUE — {n} convention{n > 1 ? "s" : ""} en zone rouge
              </span>
              <span className="block text-sm opacity-90">
                Cliquez ici pour arrêter l'alarme et lire le résumé.
              </span>
            </span>
          </button>
        ) : (
          <div className="max-h-[80vh] overflow-y-auto">
            <div className="flex items-center gap-2 bg-destructive px-4 py-3 text-destructive-foreground">
              <AlertTriangle className="h-5 w-5" />
              <p className="font-bold">Résumé de la situation</p>
            </div>
            <div className="space-y-3 p-4 text-sm text-foreground">
              <p>
                {n} convention{n > 1 ? "s actives arrivent" : " active arrive"} à échéance dans
                moins de {SEUIL_URGENCE_JOURS} jours ou {n > 1 ? "ont" : "a"} atteint la date
                limite de préavis contractuel. Une décision rapide du Directeur est requise.
              </p>
              <ul className="space-y-2">
                {critiques.map((c) => {
                  const j = joursRestants(c.date_echeance);
                  const preavis = dateLimitePreavis(c.date_echeance, c.preavis_mois);
                  const preavisAtteint = !!preavis && joursRestants(preavis) <= 0;
                  return (
                    <li key={c.id} className="rounded-lg border border-border bg-muted p-3">
                      <p className="font-semibold text-uk-blue">
                        {c.partenaire_nom}{" "}
                        <span className="font-normal text-muted-foreground">
                          ({c.partenaire_pays})
                        </span>
                      </p>
                      <p>
                        Pôle : {c.pole} — Cadre : {c.cadre_juridique}
                      </p>
                      <p>
                        Date limite : <strong>{formatDate(c.date_echeance)}</strong> —{" "}
                        <strong className="text-destructive">J - {j} jour{j > 1 ? "s" : ""}</strong>
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
              <div className="flex justify-end">
                <button
                  onClick={prendreActe}
                  className="rounded-md bg-uk-blue px-4 py-2 font-semibold text-primary-foreground hover:brightness-110"
                >
                  J'ai pris acte
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
