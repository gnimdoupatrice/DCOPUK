import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallPwa() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone || sessionStorage.getItem("dcop_pwa_hide")) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) {
      setIos(true);
      setHidden(false);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      setHidden(false);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden || (!evt && !ios)) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-uk-blue p-3 text-primary-foreground shadow-xl">
      <img src="/icon-192.png" alt="" className="h-10 w-10 rounded-lg bg-card" />
      <div className="flex-1 text-sm">
        <p className="font-semibold">Installer l'application DCOP</p>
        {ios ? (
          <p className="text-xs opacity-90">
            Touchez <Share className="inline h-3 w-3" /> Partager puis « Sur l'écran d'accueil ».
          </p>
        ) : (
          <p className="text-xs opacity-90">Accès direct depuis votre smartphone.</p>
        )}
      </div>
      {evt && (
        <button
          onClick={async () => {
            await evt.prompt();
            await evt.userChoice;
            setEvt(null);
            setHidden(true);
          }}
          className="inline-flex items-center gap-1 rounded-md bg-uk-gold px-3 py-1.5 text-sm font-semibold text-uk-navy"
        >
          <Download className="h-4 w-4" /> Installer
        </button>
      )}
      <button
        aria-label="Fermer"
        onClick={() => {
          sessionStorage.setItem("dcop_pwa_hide", "1");
          setHidden(true);
        }}
        className="opacity-80 hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
