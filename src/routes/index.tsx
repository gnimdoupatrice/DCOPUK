import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  FlaskConical,
  FolderKanban,
  Globe,
  GraduationCap,
  Handshake,
  Landmark,
  Plane,
  Scale,
  Star,
  Target,
} from "lucide-react";
import { SiteHeader } from "@/components/dcop/SiteHeader";
import { UkFooter } from "@/components/dcop/UkFooter";
import partenariatImg from "@/assets/partenariat.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "DCOP — Direction de la Coopération et des Partenariats | Université de Kara",
      },
      {
        name: "description",
        content:
          "Portail officiel de la Direction de la Coopération et des Partenariats (DCOP) de l'Université de Kara : missions, organisation, domaines de coopération et accès rapides aux partenariats.",
      },
      {
        property: "og:title",
        content: "DCOP — Direction de la Coopération et des Partenariats | Université de Kara",
      },
      {
        property: "og:description",
        content:
          "Coopération & Partenariats : l'Université de Kara cultive une politique d'ouverture dynamique pour s'affirmer comme un pôle d'excellence au Togo et à l'international.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Index,
});

const keyFigures = [
  { value: "45+", label: "Universités partenaires" },
  { value: "18+", label: "Pays Représentés" },
  { value: "80+", label: "Étudiants en mobilité/an" },
  { value: "25+", label: "Partenariats internationaux" },
];

const strategicAxes = [
  {
    title: "Image de marque institutionnelle",
    text: "Construire une image forte à l’intérieur et hors de l’Université de Kara.",
  },
  {
    title: "Rayonnement et Visibilité",
    text: "Renforcer la présence de l’Université de Kara au Togo et à l’étranger.",
  },
  {
    title: "Stratégie de communication",
    text: "Mettre en œuvre une communication active sur les opportunités de partenariat.",
  },
];

const operationalUnits = [
  {
    title: "Section Juridique",
    mission:
      "Garantir la sécurité juridique et la pérennité des engagements institutionnels de l’Université.",
    tasks: [
      "Rédiger les conventions de l’UK.",
      "Vulgariser le cadre juridique.",
      "Suivi et rapports annuels.",
      "Réactivation d’accords.",
      "Gestion de base de données.",
      "Renouvellement échéances.",
    ],
    panelClass: "bg-uk-blue text-white",
    dotClass: "bg-uk-blue",
    Icon: Scale,
  },
  {
    title: "Relations Internationales",
    mission: "Développer le réseau mondial et la coopération régionale dynamique.",
    tasks: [
      "Politique extérieure de l’UK.",
      "Réseaux thématiques.",
      "Accords bilatéraux.",
      "Pistes d’actions agissantes.",
      "Coopération sous-régionale.",
      "Redynamisation des liens.",
    ],
    panelClass: "bg-uk-gold text-uk-navy",
    dotClass: "bg-uk-gold",
    Icon: Globe,
  },
  {
    title: "Appui aux Projets",
    mission: "Centraliser, suivre et évaluer les projets de développement à impact.",
    tasks: [
      "Registre des projets à l’UK.",
      "Recensement & domaines.",
      "Évaluation opérationnelle.",
      "Cadre de concertation.",
      "Partage d’expériences.",
      "Rapport annuel global.",
    ],
    panelClass: "bg-uk-green text-white",
    dotClass: "bg-uk-green",
    Icon: FolderKanban,
  },
];

const cooperationTypes = [
  {
    title: "Coopération académique",
    text: "Échange de connaissances, co-diplomation et mobilité des enseignants-chercheurs.",
    Icon: GraduationCap,
    iconClass: "bg-uk-blue/10 text-uk-blue",
  },
  {
    title: "Coopération scientifique",
    text: "Projets de recherche conjoints et publications communes au niveau international.",
    Icon: FlaskConical,
    iconClass: "bg-uk-gold/25 text-uk-navy",
  },
  {
    title: "Coopération institutionnelle",
    text: "Collaboration avec les ministères et organisations pour le renforcement des capacités.",
    Icon: Landmark,
    iconClass: "bg-uk-green/10 text-uk-green",
  },
  {
    title: "Coopération socio-économique",
    text: "Partenariats avec le secteur privé et ONG pour le développement régional.",
    Icon: Handshake,
    iconClass: "bg-uk-blue/10 text-uk-blue",
  },
];

const quickAccess = [
  {
    title: "Partenariat National",
    text: "Accords de coopération et collaboration avec les universités et institutions nationales.",
    href: "https://univkara.tg/partenariat-national",
    cta: "Explorer",
    Icon: Building2,
  },
  {
    title: "Partenariat International",
    text: "Accords de coopération et de collaboration avec universités et organisations internationales.",
    href: "https://univkara.tg/partenariat-international",
    cta: "Explorer",
    Icon: Globe,
  },
  {
    title: "Mobilités Internationales",
    text: "Stages à l’étranger et bourses de mobilité pour les étudiants et enseignants.",
    href: "https://univkara.tg/mobilites",
    cta: "Explorer",
    Icon: Plane,
  },
  {
    title: "Projets et Programmes",
    text: "Programmes de coopération multilatéraux et projets de renforcement des capacités académiques.",
    href: "https://univkara.tg/projets",
    cta: "Explorer",
    Icon: FolderKanban,
  },
  {
    title: "Devenir Partenaire",
    text: "Vous souhaitez initier une collaboration ? Découvrez les étapes de formalisation d’un accord.",
    href: "https://univkara.tg/devenir-partenaire",
    cta: "Démarrer",
    Icon: Handshake,
  },
];

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="mb-3 text-center">
      <h2 className="text-2xl font-extrabold uppercase tracking-wide text-uk-blue sm:text-3xl">
        {children}
      </h2>
      <div className="mx-auto mt-3 h-1 w-12 rounded bg-uk-gold" />
    </div>
  );
}

function Index() {
  return (
    <div className="min-h-screen bg-background font-body">
      <SiteHeader />

      {/* Hero — ouverture internationale */}
      <section className="bg-gradient-to-br from-uk-royal via-uk-blue to-uk-navy px-4 py-16 text-white sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-uk-gold-soft">
            <Globe className="h-4 w-4" />
            Ouverture internationale
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold uppercase tracking-wider sm:text-5xl lg:text-6xl">
            Coopération <span className="text-uk-gold">& Partenariats</span>
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-white/90 sm:text-lg">
            L’Université de Kara cultive une politique d’ouverture dynamique pour s’affirmer comme
            un pôle d’excellence au Togo et à l’international. Cette ambition est portée par une
            structure dédiée qui transforme les visions en alliances concrètes : la Direction de la
            Coopération et les Partenariats.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {keyFigures.map((fig) => (
            <div
              key={fig.label}
              className="rounded-xl bg-white/10 px-6 py-8 text-center backdrop-blur-sm"
            >
              <div className="text-4xl font-extrabold text-uk-gold">{fig.value}</div>
              <div className="mt-2 text-sm text-white/90">{fig.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Missions de la DCOP – UK */}
      <section className="bg-slate-100 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-8 shadow-sm sm:p-12">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-uk-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-uk-blue">
                <Target className="h-3.5 w-3.5" />
                Stratégie
              </span>
              <h2 className="mt-4 font-display text-3xl font-semibold uppercase tracking-wide text-uk-blue">
                Missions de la DCOP – UK
              </h2>
              <div className="mt-3 h-1 w-16 rounded bg-uk-gold" />
              <p className="mt-5 leading-relaxed text-muted-foreground">
                La Direction de la Coopération et des Partenariats de l’Université de Kara assure la
                continuité des missions de rayonnement pour positionner l’Université de Kara comme
                un partenaire de référence à travers trois axes majeurs :
              </p>
              <ul className="mt-6 space-y-5">
                {strategicAxes.map((axe) => (
                  <li key={axe.title} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-uk-gold/20">
                      <Star className="h-4 w-4 fill-uk-gold text-uk-gold" />
                    </span>
                    <div>
                      <h3 className="font-semibold uppercase tracking-wide text-foreground">
                        {axe.title}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">{axe.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <img
              src={partenariatImg}
              alt="Missions DCOP Université de Kara — poignée de main institutionnelle"
              className="h-full w-full rounded-xl object-cover shadow-md"
            />
          </div>
        </div>
      </section>

      {/* Organisation opérationnelle */}
      <section className="bg-white px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionTitle>Organisation Opérationnelle</SectionTitle>
          <div className="mt-10 space-y-8">
            {operationalUnits.map((unit) => (
              <div
                key={unit.title}
                className="grid overflow-hidden rounded-2xl shadow-sm ring-1 ring-border md:grid-cols-[2fr_3fr]"
              >
                <div className={`p-8 ${unit.panelClass}`}>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/20">
                    <unit.Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="mt-6 text-xl font-bold">{unit.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed opacity-90">{unit.mission}</p>
                </div>
                <div className="bg-card p-8">
                  <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                    {unit.tasks.map((task) => (
                      <li key={task} className="flex items-start gap-2 text-sm text-foreground/85">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unit.dotClass}`} />
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Types de coopération */}
      <section className="bg-slate-100 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionTitle>Types de Coopération</SectionTitle>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {cooperationTypes.map((type) => (
              <div
                key={type.title}
                className="flex items-start gap-4 rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border"
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${type.iconClass}`}
                >
                  <type.Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-bold text-foreground">{type.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {type.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Accès rapides — redirection vers le site mère */}
      <section className="bg-white px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionTitle>Accès rapides</SectionTitle>
          <p className="mx-auto mb-10 max-w-2xl text-center text-muted-foreground">
            La Direction de la Coopération et des Partenariats de l’UK structure ses échanges
            autour de pôles stratégiques. Sélectionnez votre domaine pour explorer nos opportunités.
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-6">
            {quickAccess.map((card, index) => (
              <a
                key={card.title}
                href={card.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`group flex flex-col rounded-2xl bg-uk-green p-7 text-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg ${
                  index < 3 ? "lg:col-span-2" : "lg:col-span-3"
                }`}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/20">
                  <card.Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg font-bold">{card.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-white/85">{card.text}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-uk-gold transition-transform group-hover:translate-x-1">
                  {card.cta}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <UkFooter />
    </div>
  );
}

