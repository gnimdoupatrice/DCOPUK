import { Facebook, Linkedin, Mail, Phone, Youtube } from "lucide-react";
import ukLogoWhite from "@/assets/uk-logo-white.png";
import { WhatsAppIcon } from "./SocialIcons";

const footerColumns = [
  {
    title: "Notre Université",
    links: [
      { label: "Présentation de l’UK", href: "https://univkara.tg/presentation" },
      { label: "Direction et services", href: "https://univkara.tg/directions-services" },
      { label: "Facultés et Instituts", href: "https://univkara.tg/facultes-et-instituts" },
      { label: "Documents Officiels", href: "https://univkara.tg/documents-officiels" },
      { label: "Annuaire des Chercheurs", href: "https://univkara.tg/annuaire-des-chercheurs" },
    ],
  },
  {
    title: "Études et Scolarité",
    links: [
      { label: "Offres de formation", href: "https://univkara.tg/offres-de-formation" },
      { label: "Inscription et scolarité", href: "https://univkara.tg/admission" },
      { label: "Bourses d’études", href: "https://univkara.tg/bourses-et-aides-financieres" },
      { label: "Bibliothèque", href: "https://univkara.tg/bibliotheque" },
      { label: "Vie estudiantine", href: "https://univkara.tg/vie-estudiantine" },
    ],
  },
  {
    title: "Médias & Ressources",
    links: [
      { label: "Actualités", href: "https://univkara.tg/actualites/" },
      { label: "Agenda", href: "https://univkara.tg/evenements" },
      { label: "UK TV (Web TV)", href: "https://univkara.tg/webtv" },
      { label: "Médias et informations", href: "https://univkara.tg/bientot-disponible/" },
      { label: "FAQ", href: "https://univkara.tg/faq" },
    ],
  },
];

const copyrightSocials = [
  {
    label: "facebook",
    href: "https://web.facebook.com/people/Universit%C3%A9-de-Kara-Togo-Officielle",
    Icon: Facebook,
  },
  {
    label: "linkedin",
    href: "https://www.linkedin.com/school/universit%C3%A9-de-kara",
    Icon: Linkedin,
  },
  {
    label: "youtube",
    href: "https://www.youtube.com/@universitedekaratv7082",
    Icon: Youtube,
  },
  {
    label: "whatsapp",
    href: "https://whatsapp.com/channel/0029VbAHxiL5q08ZrsJ0LZ41",
    Icon: WhatsAppIcon,
  },
];

export function UkFooter() {
  return (
    <footer className="bg-uk-navy text-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {/* Coordonnées officielles */}
        <div>
          <img
            src={ukLogoWhite}
            alt="Université de Kara"
            className="mb-4 h-12 w-auto"
          />
          <p className="text-sm leading-relaxed text-white/90">
            <u>Campus Sud :</u> Route de l’ex ENI, BP : 43,
            <br />
            Kara – Togo,{" "}
            <a
              href="tel:+22826685228"
              className="inline-flex items-center gap-1 text-white transition-colors hover:text-uk-gold"
            >
              <Phone className="h-3 w-3" /> +228 26 68 52 28
            </a>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/90">
            <u>Présidence :</u> Route Nationale N°1 BP : 404,
            <br />
            Kara – Togo,{" "}
            <a
              href="tel:+22826610285"
              className="inline-flex items-center gap-1 text-white transition-colors hover:text-uk-gold"
            >
              <Phone className="h-3 w-3" /> +228 26 61 02 85
            </a>
          </p>
          <a
            href="mailto:contact@univkara.tg"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-white transition-colors hover:text-uk-gold"
          >
            <Mail className="h-3.5 w-3.5" /> contact@univkara.tg
          </a>
        </div>

        {footerColumns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="mb-4 text-base font-bold uppercase tracking-wide text-white">
              {col.title}
            </h3>
            <ul className="space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white/75 transition-colors hover:text-uk-gold"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-sm text-white/80 sm:flex-row sm:px-6">
          <p>Copyright © {new Date().getFullYear()} Université de Kara. Tous droits réservés.</p>
          <div className="flex items-center gap-4">
            {copyrightSocials.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                title={label}
                className="text-white/70 transition-colors hover:text-uk-gold"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
