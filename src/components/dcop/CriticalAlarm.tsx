import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, Clock, CheckCircle } from "lucide-react";
import { arreterAlerte, reporterAlerte } from "@/components/dcop/RegulariserAlerte";
import {
  type Convention,
  formatDate,
  joursRestants,
  etatAlerte,
  momentReferenceAlerte,
} from "@/lib/conventions";

const AUDIO_PERSO = "/alarme.mp3";
const DUREE_ALARME_MS = 60_000; // 1 minute complète (60 secondes)

class SireneLimitee {
  private ctx: AudioContext | null = null;
  private timer: number | null = null;
  private stopTimeout: number | null = null;
  private audio: HTMLAudioElement | null = null;

  async start(onFinished?: () => void) {
    if (this.timer || this.audio || this.stopTimeout) return;

    // Arrêt automatique au bout de 60 secondes
    this.stopTimeout = window.setTimeout(() => {
      this.stop();
      onFinished?.();
    }, DUREE_ALARME_MS);

    try {
      const head = await fetch(AUDIO_PERSO, { method: "HEAD" });
      if (head.ok && (head.headers.get("content-type") ?? "").startsWith("audio")) {
        const a = new Audio(AUDIO_PERSO);
        a.loop = true; // boucle continue pendant la minute
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

  resume() {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
    if (this.audio?.paused) void this.audio.play().catch(() => {});
  }

  stop() {
    if (this.stopTimeout) {
      window.clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }
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

export function CriticalAlarm({
  conventions,
  onRefresh,
  onActiveChange,
}: {
  conventions: Convention[];
  onRefresh?: () => void;
  onActiveChange?: (id: string | null) => void;
}) {
  // Surcharges locales immédiates (report / arrêt) en attendant le rechargement du registre
  const [overrides, setOverrides] = useState<
    Record<string, { reportee?: string | null; arretee?: string | null }>
  >({});
  const dejaSonne = useRef<Set<string>>(new Set());
  const [tick, setTick] = useState(0);
  const [activeConvention, setActiveConvention] = useState<Convention | null>(null);
  const [isRinging, setIsRinging] = useState(false);
  const [snoozeDateTime, setSnoozeDateTime] = useState("");
  const [showSnoozeInput, setShowSnoozeInput] = useState(false);
  const sirene = useRef<SireneLimitee | null>(null);

  // Vérification chaque minute
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Détection de la convention dont l'alarme doit sonner maintenant
  const conventionDeclenchee = useMemo(() => {
    const now = new Date();

    for (const brut of conventions) {
      const o = overrides[brut.id];
      const c: Convention = o
        ? {
            ...brut,
            ...(o.reportee !== undefined ? { alarme_reportee_jusqu_a: o.reportee } : {}),
            ...(o.arretee !== undefined ? { alarme_arretee_le: o.arretee } : {}),
          }
        : brut;
      if (c.archived) continue;
      const j = joursRestants(c.date_echeance);
      if (j < 0) continue; // expirée ignorée

      // 1. Si déjà arrêtée définitivement par le Directeur -> aucune alarme
      if (c.alarme_arretee_le) continue;

      // 2. Moment de référence : report éventuel, sinon heure H programmée
      const ref = momentReferenceAlerte(c);
      if (!ref) continue;
      if (etatAlerte(c, now.getTime()) !== "sonnerie") continue; // aucun son rétroactif
      const diff = now.getTime() - ref.getTime();
      const type = diff < 3600_000 ? ("premiere" as const) : ("deuxieme" as const);
      const key = `${c.id}|${type}|${ref.getTime()}`;
      if (!dejaSonne.current.has(key)) return { convention: c, type, key };
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conventions, tick, overrides]);

  useEffect(() => {
    if (!conventionDeclenchee) return;
    const { convention, key } = conventionDeclenchee;
    if (activeConvention) return; // une alarme est déjà affichée
    dejaSonne.current.add(key);
    setActiveConvention(convention);
    onActiveChange?.(convention.id);

    // Initialise l'heure de report par défaut (+1 heure)
    const defSnooze = new Date(Date.now() + 60 * 60 * 1000);
    const localIso = new Date(defSnooze.getTime() - defSnooze.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setSnoozeDateTime(localIso);

    // Déclenchement de la sonnerie pour 1 minute
    if (!sirene.current) sirene.current = new SireneLimitee();
    setIsRinging(true);
    void sirene.current.start(() => {
      setIsRinging(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conventionDeclenchee]);

  // Déblocage audio si contrainte navigateur (autoplay)
  useEffect(() => {
    if (!isRinging) return;
    const unlock = () => sirene.current?.resume();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [isRinging]);

  useEffect(() => () => sirene.current?.stop(), []);

  function couperSon() {
    sirene.current?.stop();
    setIsRinging(false);
  }

  // Arrêt définitif de l'alarme pour  CETTE CONVENTION is ok
  async function arreterDefinitivement() {
    if (!activeConvention) return;
    couperSon();
    const nowIso = new Date().toISOString();
    const id = activeConvention.id;
    setOverrides((o) => ({ ...o, [id]: { reportee: null, arretee: nowIso } }));
    setActiveConvention(null);
    onActiveChange?.(null);
    await arreterAlerte(id);
    onRefresh?.();
  }

  // Report de l'alarme à une date et heure choisie
  async function validerReport() {
    if (!activeConvention || !snoozeDateTime) return;
    couperSon();
    const targetIso = new Date(snoozeDateTime).toISOString();
    const id = activeConvention.id;
    setOverrides((o) => ({ ...o, [id]: { reportee: targetIso, arretee: null } }));
    setActiveConvention(null);
    setShowSnoozeInput(false);
    onActiveChange?.(null);
    await reporterAlerte(id, snoozeDateTime);
    onRefresh?.();
  }

  if (!activeConvention) return null;

  const j = joursRestants(activeConvention.date_echeance);
  const heureAffichee = activeConvention.heure_alerte || "00:00";

  return (
    <div className="fixed inset-x-0 top-0 z-[70] flex justify-center p-3 animate-in fade-in slide-in-from-top-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border-2 border-destructive bg-card shadow-2xl">
        <div className="flex items-center justify-between bg-destructive px-4 py-3 text-destructive-foreground">
          <div className="flex items-center gap-2">
            <BellRing className={`h-6 w-6 shrink-0 ${isRinging ? "animate-bounce" : ""}`} />
            <div>
              <p className="font-bold">ALERTE CONVENTION — HEURE PROGRAMMÉE</p>
              <p className="text-xs opacity-90">Heure de consigne : {heureAffichee}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5 text-sm text-foreground">
          <div className="rounded-xl border border-border bg-muted/60 p-4">
            <p className="text-base font-bold text-uk-blue">{activeConvention.partenaire_nom}</p>
            <p className="text-xs text-muted-foreground">
              {activeConvention.pole} — {activeConvention.cadre_juridique}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded bg-rose-100 px-2 py-0.5 font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                Échéance : {formatDate(activeConvention.date_echeance)} (J - {j} jours)
              </span>
            </div>
          </div>

          {!showSnoozeInput ? (
            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowSnoozeInput(true)}
                className="flex items-center justify-center gap-2 rounded-xl border border-input bg-background px-4 py-2.5 font-medium text-foreground hover:bg-muted"
              >
                <Clock className="h-4 w-4 text-amber-600" />
                Reporter l'alerte
              </button>
              <button
                type="button"
                onClick={arreterDefinitivement}
                className="flex items-center justify-center gap-2 rounded-xl bg-destructive px-5 py-2.5 font-semibold text-destructive-foreground shadow hover:brightness-110"
              >
                <CheckCircle className="h-4 w-4" />
                Arrêter définitivement
              </button>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
              <p className="font-semibold text-foreground">
                Choisir la date et l'heure précise du prochain rappel :
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="datetime-local"
                  value={snoozeDateTime}
                  onChange={(e) => setSnoozeDateTime(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-uk-blue focus:outline-none"
                />
                <button
                  type="button"
                  onClick={validerReport}
                  className="rounded-lg bg-uk-blue px-4 py-2 text-xs font-semibold text-white shadow hover:brightness-110"
                >
                  Confirmer le report
                </button>
                <button
                  type="button"
                  onClick={() => setShowSnoozeInput(false)}
                  className="rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}