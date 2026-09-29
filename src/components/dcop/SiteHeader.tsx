import { Link } from "@tanstack/react-router";
import { Facebook, Linkedin, Lock, Phone, Youtube } from "lucide-react";
import ukEmblem from "@/assets/uk-emblem.png";
import { TikTokIcon, WhatsAppIcon, XIcon } from "./SocialIcons";

const socials = [
  {
    label: "WhatsApp",
    href: "https://whatsapp.com/channel/0029VbAHxiL5q08ZrsJ0LZ41",
    Icon: WhatsAppIcon,
  },
  { label: "TikTok", href: "https://www.tiktok.com/@univkara_togo", Icon: TikTokIcon },
  { label: "Facebook", href: "https://web.facebook.com/61574585205325", Icon: Facebook },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/school/universit%C3%A9-de-kara",
    Icon: Linkedin,
  },
  { label: "X (Twitter)", href: "https://x.com/KaraUniversite", Icon: XIcon },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@universitedekaratv7082",
    Icon: Youtube,
  },
];

function GreenButton({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-7 shrink-0 items-center rounded-sm bg-uk-green px-4 text-xs font-bold tracking-wide text-white transition-colors hover:brightness-110"
    >
      {children}
    </a>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50">
      {/* Barre supérieure — coordonnées officielles & réseaux sociaux institutionnels */}
      <div className="bg-uk-navy text-white">
        <div className="mx-auto flex h-10 max-w-7xl items-center justify-between gap-3 px-4 text-xs sm:px-6">
          <GreenButton href="https://etu.univkara.tg/">Inscription</GreenButton>

          <div className="flex items-center gap-4">
            <a
              href="tel:+22826685228"
              className="hidden items-center gap-1.5 font-medium text-white/90 transition-colors hover:text-uk-gold md:inline-flex"
            >
              <Phone className="h-3.5 w-3.5" />
              +228 26 68 52 28
            </a>
            <a
              href="mailto:dtic@univkara.tg"
              className="hidden text-white/90 transition-colors hover:text-uk-gold sm:inline"
            >
              Centre d&rsquo;aide : dtic@univkara.tg
            </a>
            <div className="hidden items-center gap-3 lg:flex">
              {socials.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="text-white/80 transition-colors hover:text-uk-gold"
                >
                  <Icon className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          </div>

          <GreenButton href="https://univkara.tg/contactez-nous">Contactez-nous</GreenButton>
        </div>
      </div>

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
