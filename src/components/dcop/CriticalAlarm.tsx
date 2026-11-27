import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, Clock, CheckCircle, Volume2, VolumeX, Phone, MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { arreterAlerte, reporterAlerte } from "@/components/dcop/RegulariserAlerte";
import { SuiviEmails } from "@/components/dcop/SuiviEmails";
import {
  type Convention,
  formatDate,
  joursRestants,
  etatAlerte,
  momentReferenceAlerte,
} from "@/lib/conventions";

type Contact = { id: string; nom: string; prenom: string; fonction: string | null; telephone: string | null; institution_type: string };

function ContactsDirects({ conventionId }: { conventionId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  useEffect(() => {
    let actif = true;
    void supabase
      .from("convention_points_focaux")
      .select("id, nom, prenom, fonction, telephone, institution_type")
      .eq("convention_id", conventionId)
      .then(({ data }) => { if (actif) setContacts(((data ?? []) as Contact[]).filter((c) => c.telephone?.trim())); });
    return () => { actif = false; };
  }, [conventionId]);
  if (contacts.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">Joindre un point focal</p>
      {contacts.map((c) => {
        const tel = c.telephone!.replace(/[^\d+]/g, "");
        return (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border bg-background p-2">
            <div className="min-w-0 text-xs">
              <p className="truncate font-semibold">{c.prenom} {c.nom}</p>
              <p className="truncate text-muted-foreground">{c.institution_type === "universite" ? "Université de Kara" : "Partenaire"}{c.fonction ? ` — ${c.fonction}` : ""}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <a href={`tel:${tel}`} aria-label={`Appeler ${c.prenom} ${c.nom}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><Phone className="h-4 w-4" /></a>
              <a href={`https://wa.me/${tel.replace(/^\+/, "")}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${c.prenom} ${c.nom}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white"><MessageCircle className="h-4 w-4" /></a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
        a.volume = 0.15;
        await a.play();
        this.audio = a;
        // Volume progressif sur ~6 secondes
        this.timer = window.setInterval(() => {
          if (!this.audio) return;
          this.audio.volume = Math.min(0.8, this.audio.volume + 0.1);
          if (this.audio.volume >= 0.8 && this.timer) { window.clearInterval(this.timer); this.timer = null; }
        }, 800);
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

      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = f;
        const s = ctx.currentTime + i * 0.35;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(0.12, s + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, s + 1.2);
        o.connect(g).connect(ctx.destination);
        o.start(s);
        o.stop(s + 1.25);
      });
    };

    bip();
    this.timer = window.setInterval(bip, 3000);
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
  const [suiviVersion, setSuiviVersion] = useState(0);
  const sirene = useRef<SireneLimitee | null>(null);
  const [sonCoupe, setSonCoupe] = useState(false);
  const canal = useRef<BroadcastChannel | null>(null);

  // Coordination entre onglets : un seul onglet sonne, couper le son coupe partout sur ce poste.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel("dcop-alarme");
    ch.onmessage = (e) => {
      if (e.data?.type === "mute") { sirene.current?.stop(); setIsRinging(false); setSonCoupe(true); }
    };
    canal.current = ch;
    return () => ch.close();
  }, []);

  // Synchronisation temps réel : une décision prise par un collègue recharge le registre.
  useEffect(() => {
    const ch = supabase
      .channel("conventions-alarme")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conventions" }, () => onRefresh?.())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vérification chaque minute
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Détection de la convention dont l'alarme doit sonner maintenant
  const conventionDeclenchee = useMemo(() => {
    const now = new Date();
    // File d'attente : la plus ancienne alerte en attente d'abord
    const ordonnees = [...conventions].sort((a, b) => {
      const ra = momentReferenceAlerte(a)?.getTime() ?? Infinity;
      const rb = momentReferenceAlerte(b)?.getTime() ?? Infinity;
      return ra - rb;
    });

    for (const brut of ordonnees) {
      const o = overrides[brut.id];
      const c: Convention = o
        ? {
            ...brut,
            ...(o.reportee !== undefined ? { alarme_reportee_jusqu_a: o.reportee } : {}),
            ...(o.arretee !== undefined ? { alarme_arretee_le: o.arretee } : {}),
          }
        : brut;
      if (c.archived || c.supprime_le) continue;
      const j = joursRestants(c.date_echeance);
      if (j < 0) continue; // expirée ignorée

      // 1. Si déjà arrêtée définitivement par le Directeur -> aucune alarme
      if (c.alarme_arretee_le) continue;

      // 2. Moment de référence : report éventuel, sinon heure H programmée
      const ref = momentReferenceAlerte(c);
      if (!ref) continue;
      if (etatAlerte(c, now.getTime()) !== "sonnerie") continue;
      const key = `${c.id}|${ref.getTime()}`;
      if (!dejaSonne.current.has(key)) return { convention: c, key };
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
    setSonCoupe(false);
    // Un seul onglet sonne par alerte sur ce poste
    const verrou = `dcop-alarme-sonne:${key}`;
    let autreOnglet = false;
    try {
      const v = Number(localStorage.getItem(verrou) ?? 0);
      autreOnglet = Date.now() - v < DUREE_ALARME_MS + 10_000;
      if (!autreOnglet) localStorage.setItem(verrou, String(Date.now()));
    } catch { /* stockage indisponible */ }
    if (!autreOnglet) {
      if (!sirene.current) sirene.current = new SireneLimitee();
      setIsRinging(true);
      void sirene.current.start(() => {
        setIsRinging(false);
      });
    }

    // Envoi immédiat des e-mails à la seconde où l'alarme sonne (anti-doublon côté serveur).
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const jeton = data.session?.access_token;
      if (!jeton) return;
      await fetch("/api/public/alertes-email", { method: "POST", headers: { Authorization: `Bearer ${jeton}` } }).catch(() => null);
      setSuiviVersion((v) => v + 1);
    })();
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

  // Une mise en corbeille ou un archivage coupe immédiatement une alarme déjà affichée.
  useEffect(() => {
    if (!activeConvention) return;
    const source = conventions.find((c) => c.id === activeConvention.id);
    const reportFutur = source?.alarme_reportee_jusqu_a && new Date(source.alarme_reportee_jusqu_a).getTime() > Date.now();
    if (source && !source.supprime_le && !source.archived && !source.alarme_arretee_le && !reportFutur) return;
    sirene.current?.stop();
    setIsRinging(false);
    setActiveConvention(null);
    onActiveChange?.(null);
  }, [conventions, activeConvention, onActiveChange]);

  function couperSon() {
    sirene.current?.stop();
    setIsRinging(false);
  }

  // Coupure locale (ce poste uniquement) : l'alerte reste ouverte.
  function couperSonLocal() {
    couperSon();
    setSonCoupe(true);
    canal.current?.postMessage({ type: "mute" });
  }

  function remettreSon() {
    if (!sirene.current) sirene.current = new SireneLimitee();
    setSonCoupe(false);
    setIsRinging(true);
    void sirene.current.start(() => setIsRinging(false));
  }

  useEffect(() => {
    if (!isRinging) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") couperSonLocal(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRinging]);

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
    if (new Date(snoozeDateTime).getTime() <= Date.now()) return;
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
              <p className="font-bold">ALERTE CONVENTION — ALERTE EN ATTENTE D'ARBITRAGE</p>
              <p className="text-xs opacity-90">Heure de consigne : {heureAffichee}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5 text-sm text-foreground">
          {isRinging ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => sirene.current?.resume()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive"
              >
                <Volume2 className="h-4 w-4 animate-pulse" /> Vous n'entendez rien ? Cliquez ici
              </button>
              <button
                type="button"
                onClick={couperSonLocal}
                className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold"
              >
                <VolumeX className="h-4 w-4" /> Couper la sonnerie (ce poste)
              </button>
            </div>
          ) : sonCoupe ? (
            <button
              type="button"
              onClick={remettreSon}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold"
            >
              <Volume2 className="h-4 w-4" /> Sonnerie coupée sur ce poste — remettre le son
            </button>
          ) : null}
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

          <ContactsDirects conventionId={activeConvention.id} />
          <SuiviEmails key={suiviVersion} conventionId={activeConvention.id} emailsAlerte={activeConvention.emails_alerte} />


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
                  min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                  onChange={(e) => setSnoozeDateTime(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-uk-blue focus:outline-none"
                />
                <button
                  type="button"
                  onClick={validerReport}
                  disabled={!snoozeDateTime || new Date(snoozeDateTime).getTime() <= Date.now()}
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
              {snoozeDateTime && new Date(snoozeDateTime).getTime() <= Date.now() && (
                <p className="text-xs font-medium text-destructive">Veuillez choisir une date et une heure futures.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}