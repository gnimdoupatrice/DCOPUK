import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BellRing, Clock, XCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  type Convention,
  formatDate,
  joursRestants,
  momentAlerteConvention,
  momentRappel8h,
} from "@/lib/conventions";

const AUDIO_PERSO = "/alarme.mp3";

class SireneLimitee {
  private ctx: AudioContext | null = null;
  private timer: number | null = null;
  private audio: HTMLAudioElement | null = null;
  private cyclesCount = 0;
  private maxCycles = 3;

  async start(onFinished?: () => void) {
    if (this.timer || this.audio) return;
    this.cyclesCount = 0;

    try {
      const head = await fetch(AUDIO_PERSO, { method: "HEAD" });
      if (head.ok && (head.headers.get("content-type") ?? "").startsWith("audio")) {
        const a = new Audio(AUDIO_PERSO);
        a.onended = () => {
          this.cyclesCount++;
          if (this.cyclesCount >= this.maxCycles) {
            this.stop();
            onFinished?.();
          } else {
            void a.play().catch(() => {});
          }
        };
        await a.play();
        this.audio = a;
        return;
      }
    } catch {
      /* repli synthèse audio */
    }
    this.startSynth(onFinished);
  }

  private startSynth(onFinished?: () => void) {
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

      this.cyclesCount++;
      if (this.cyclesCount >= this.maxCycles) {
        if (this.timer) {
          window.clearInterval(this.timer);
          this.timer = null;
        }
        onFinished?.();
      }
    };

    bip();
    this.timer = window.setInterval(bip, 1400);
  }

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

export function CriticalAlarm({
  conventions,
  onRefresh,
}: {
  conventions: Convention[];
  onRefresh?: () => void;
}) {
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

    for (const c of conventions) {
      if (c.archived) continue;
      const j = joursRestants(c.date_echeance);
      if (j < 0) continue; // expirée ignorée

      // 1. Si déjà arrêtée définitivement par le Directeur -> aucune alarme
      if (c.alarme_arretee_le) continue;

      // 2. Si un report personnalisé est en cours
      if (c.alarme_reportee_jusqu_a) {
        const report = new Date(c.alarme_reportee_jusqu_a);
        if (now >= report && now.getTime() - report.getTime() < 3600_000) {
          return { convention: c, type: "report" as const };
        }
        continue;
      }

      // 3. Calcul de la première alarme (Date + Heure précise ou 00:00)
      const premiereAlarme = momentAlerteConvention(c);
      const diffPremiere = now.getTime() - premiereAlarme.getTime();

      // Première alarme sonne si on a atteint l'heure et dans l'heure qui suit
      if (diffPremiere >= 0 && diffPremiere < 3600_000) {
        return { convention: c, type: "premiere" as const };
      }

      // 4. Deuxième alarme : 8 heures après la première
      const deuxiemeAlarme = momentRappel8h(c);
      const diffDeuxieme = now.getTime() - deuxiemeAlarme.getTime();
      if (diffDeuxieme >= 0 && diffDeuxieme < 3600_000) {
        return { convention: c, type: "deuxieme" as const };
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conventions, tick]);

  useEffect(() => {
    if (!conventionDeclenchee) {
      setActiveConvention(null);
      return;
    }

    const { convention } = conventionDeclenchee;
    setActiveConvention(convention);

    // Initialise l'heure de report par défaut (+1 heure)
    const defSnooze = new Date(Date.now() + 60 * 60 * 1000);
    const localIso = new Date(defSnooze.getTime() - defSnooze.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setSnoozeDateTime(localIso);

    // Déclenchement de la sonnerie (3 fois)
    if (!sirene.current) sirene.current = new SireneLimitee();
    setIsRinging(true);
    void sirene.current.start(() => {
      setIsRinging(false);
    });
  }, [conventionDeclenchee]);

  // Déblocage audio si contrainte navigateur
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

  // Arrêt définitif de l'alarme pour cette convention
  async function arreterDefinitivement() {
    if (!activeConvention) return;
    couperSon();
    const nowIso = new Date().toISOString();
    await supabase
      .from("conventions")
      .update({
        alarme_arretee_le: nowIso,
        alarme_reportee_jusqu_a: null,
      })
      .eq("id", activeConvention.id);

    await supabase.from("convention_historique").insert({
      convention_id: activeConvention.id,
      action: "Alarme arrêtée définitivement",
      note: "Le Directeur a pris acte et a désactivé les sonneries de cette échéance.",
    });

    setActiveConvention(null);
    onRefresh?.();
  }

  // Report de l'alarme à une date et heure choisie
  async function validerReport() {
    if (!activeConvention || !snoozeDateTime) return;
    couperSon();
    const targetIso = new Date(snoozeDateTime).toISOString();
    await supabase
      .from("conventions")
      .update({
        alarme_reportee_jusqu_a: targetIso,
      })
      .eq("id", activeConvention.id);

    await supabase.from("convention_historique").insert({
      convention_id: activeConvention.id,
      action: "Alarme reportée",
      note: `Alarme reportée jusqu'au ${new Date(snoozeDateTime).toLocaleString("fr-FR")}`,
    });

    setActiveConvention(null);
    setShowSnoozeInput(false);
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
          {isRinging && (
            <button
              onClick={couperSon}
              className="rounded-lg bg-black/30 px-3 py-1 text-xs font-semibold hover:bg-black/50"
            >
              Couper la sonnerie
            </button>
          )}
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
                Reporter l'alarme
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