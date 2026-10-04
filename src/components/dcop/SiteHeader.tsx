import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import ukEmblem from "@/assets/uk-emblem.png";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50">
      {/* Navigation principale — deux onglets : Service Public / Service Privé */}
      <div className="border-b border-border bg-white shadow-sm">
        <div className="mx-auto flex min-h-[60px] max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:h-20 sm:gap-4 sm:px-6 sm:py-0">
          <Link to="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
            <img
              src={ukEmblem}
              alt="Logo officiel de l'Université de Kara"
              className="h-10 w-auto shrink-0 sm:h-14"
            />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="font-display text-lg font-bold tracking-wide text-uk-blue sm:text-2xl">
                DCOP
              </span>
              <span className="max-w-[135px] text-[8.5px] font-medium uppercase leading-tight tracking-wider text-uk-blue/70 sm:max-w-[220px] sm:text-[10px]">
                Direction de la Coopération et des Partenariats
              </span>
            </span>
          </Link>

          <nav className="flex shrink-0 items-center gap-1 sm:gap-2" aria-label="Navigation principale">
            <Link
              to="/"
              activeProps={{ className: "bg-uk-green text-white font-bold" }}
              className="inline-flex items-center rounded-md px-2.5 py-1.5 text-xs font-semibold text-uk-blue transition-colors hover:bg-uk-green/10 sm:px-4 sm:py-2 sm:text-sm"
              activeOptions={{ exact: true }}
            >
              Service Public
            </Link>
            <Link
              to="/service-prive"
              activeProps={{ className: "bg-uk-green text-white font-bold" }}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-uk-blue transition-colors hover:bg-uk-green/10 sm:gap-1.5 sm:px-4 sm:py-2 sm:text-sm"
            >
              <Lock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              Service Privé
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
s