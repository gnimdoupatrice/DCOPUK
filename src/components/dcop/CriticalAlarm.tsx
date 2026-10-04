import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BellRing } from "lucide-react";
import {
  type Convention,
  SEUIL_URGENCE_JOURS,
  dateLimitePreavis,
  formatDate,
  joursRestants,
  preavisAtteint,
  seuilDe,
} from "@/lib/conventions";

/** Fichier audio optionnel (public/alarme.mp3). Repli automatique : carillon Web Audio. */
const AUDIO_PERSO = "/alarme.mp3";
const ACK_KEY = "dcop_alarme_ack";

/** Convention active, non expirée, ayant atteint son seuil (personnalisé ou J-150) ou son préavis. */
export function estCritique(c: Convention): boolean {
  if (c.archived) return false;
  const j = joursRestants(c.date_echeance);
  if (j < 0) return false;
  return j <= seuilDe(c) || preavisAtteint(c);
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
      /* repli synthèse audio */
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

  /** Débloque l'audio si la lecture automatique initiale a été restreinte par le navigateur */
  resume() {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
    if (this.audio?.paused) void this.audio.play().catch(() => {});
  }

  stop() {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
  }
}

export function CriticalAlarm({ conventions }: { conventions: Convention[] }) {
  const [tick, setTick] = useState(0);
  const [ringing, setRinging] = useState(false);
  const [open, setOpen] = useState(false);
  const sirene = useRef<Sirene | null>(null);

  // Vérification périodique chaque minute
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

  // Déclenchement à la connexion si des conventions sont en alerte et non encore acquittées aujourd'hui
  useEffect(() => {
    if (!signature || open) return;
    const jour = new Date().toISOString().slice(0, 10);
    if (sessionStorage.getItem(ACK_KEY) === `${jour}#${signature}`) return;

    if (!sirene.current) sirene.current = new Sirene();
    void sirene.current.start();
    setRinging(true);
  }, [signature, open]);

  // Si l'autoplay audio est bloqué par le navigateur, la première interaction tactile/clavier le relance
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

  function stopperEtOuvrir() {
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
            onClick={stopperEtOuvrir}
            className="flex w-full animate-pulse items-center gap-3 bg-destructive px-4 py-3.5 text-left text-destructive-foreground transition-opacity hover:opacity-95"
          >
            <BellRing className="h-6 w-6 shrink-0" />
            <span className="flex-1">
              <span className="block font-bold">
                ALERTE ÉCHÉANCES — {n} convention{n > 1 ? "s" : ""} prioritaire{n > 1 ? "s" : ""}
              </span>
              <span className="block text-xs opacity-90">
                Cliquez pour couper la sonnerie et consulter le résumé.
              </span>
            </span>
          </button>
        ) : (
          <div className="max-h-[82vh] overflow-y-auto">
            <div className="flex items-center gap-2 bg-destructive px-4 py-3 text-destructive-foreground">
              <AlertTriangle className="h-5 w-5" />
              <p className="font-bold">Résumé de la situation des conventions</p>
            </div>
            <div className="space-y-3 p-4 text-sm text-foreground">
              <p>
                {n} convention{n > 1 ? "s actives ont" : " active a"} atteint le seuil d'alerte,
                la zone critique (&lt; {SEUIL_URGENCE_JOURS} jours) ou la date limite de préavis.
                Une décision du Directeur est requise.
              </p>
              <ul className="space-y-2.5">
                {critiques.map((c) => {
                  const j = joursRestants(c.date_echeance);
                  const preavis = dateLimitePreavis(c.date_echeance, c.preavis_mois);
                  const pa = preavisAtteint(c);
                  const rouge = j < SEUIL_URGENCE_JOURS || pa;
                  return (
                    <li key={c.id} className="rounded-lg border border-border bg-muted p-3">
                      <p className="font-semibold text-uk-blue">
                        {c.partenaire_nom}{" "}
                        <span className="font-normal text-muted-foreground">
                          ({c.partenaire_pays})
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pôle : {c.pole} — Cadre : {c.cadre_juridique}
                      </p>
                      <p className="mt-1">
                        Date limite : <strong>{formatDate(c.date_echeance)}</strong> —{" "}
                        <strong className={rouge ? "text-destructive" : "text-amber-600"}>
                          J - {j} jour{j > 1 ? "s" : ""}
                        </strong>
                        {preavis && <> — préavis au {formatDate(preavis)}</>}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Recommandation :{" "}
                        {pa
                          ? "Délai de préavis contractuel atteint ; notifier formellement le partenaire sans attendre."
                          : `Engager la procédure de ${c.reconduction?.toLowerCase().includes("tacite") ? "confirmation ou dénonciation" : "renouvellement par avenant"} avant l'échéance.`}
                      </p>
                    </li>
                  );
                })}
              </ul>
              <div className="flex justify-end pt-2">
                <button
                  onClick={prendreActe}
                  className="rounded-lg bg-uk-blue px-5 py-2.5 font-semibold text-primary-foreground shadow hover:brightness-110"
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
