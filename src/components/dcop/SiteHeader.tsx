import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import ukEmblem from "@/assets/uk-emblem.png";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50">
      {/* Navigation principale — deux onglets : Service Public / Service Privé */}
      <div className="border-b border-border bg-white shadow-sm">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={ukEmblem}
              alt="Logo officiel de l'Université de Kara"
              className="h-14 w-auto"
            />
            <span className="flex flex-col leading-tight">
              <span className="font-display text-2xl font-bold tracking-wide text-uk-blue">
                DCOP
              </span>
              <span className="max-w-[220px] text-[10px] font-medium uppercase tracking-wider text-uk-blue/70">
                Direction de la Coopération et des Partenariats
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Navigation principale">
            <Link
              to="/"
              activeProps={{ className: "bg-uk-green text-white font-bold" }}
              className="inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold text-uk-blue transition-colors hover:bg-uk-green/10 sm:px-4"
              activeOptions={{ exact: true }}
            >
              Service Public
            </Link>
            <Link
              to="/service-prive"
              activeProps={{ className: "bg-uk-green text-white font-bold" }}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-uk-blue transition-colors hover:bg-uk-green/10 sm:px-4"
            >
              <Lock className="h-3.5 w-3.5" />
              Service Privé
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
