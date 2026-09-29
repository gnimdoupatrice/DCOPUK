import { createFileRoute, Link } from "@tanstack/react-router";
import { BellRing, Lock, Table2, Users } from "lucide-react";
import ukEmblem from "@/assets/uk-emblem.png";

export const Route = createFileRoute("/service-prive")({
  head: () => ({
    meta: [
      { title: "Service Privé — DCOP | Université de Kara" },
      {
        name: "description",
        content:
          "Espace privé de la Direction de la Coopération et des Partenariats (DCOP) de l'Université de Kara : alertes conventions, gestion du personnel et tracking des dossiers.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ServicePrivePage,
});

const modules = [
  { Icon: BellRing, label: "Alertes Conventions (J-5 mois)" },
  { Icon: Users, label: "Personnel & Présences" },
  { Icon: Table2, label: "Tracking des Dossiers" },
];

function ServicePrivePage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-uk-royal via-uk-blue to-uk-navy font-body">
      <div className="flex flex-1 items-center justify-center px-4 py-20">
        <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-xl">
          <img src={ukEmblem} alt="Université de Kara" className="mx-auto h-16 w-auto" />
          <span className="mt-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-uk-blue/10">
            <Lock className="h-6 w-6 text-uk-blue" />
          </span>
          <h1 className="mt-4 text-xl font-bold text-uk-blue">Service Privé — DCOP</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Espace réservé à l’administration de la Direction de la Coopération et des Partenariats
            :
          </p>
          <ul className="mt-4 space-y-2 text-sm text-foreground/85">
            {modules.map(({ Icon, label }) => (
              <li key={label} className="flex items-center justify-center gap-2">
                <Icon className="h-4 w-4 text-uk-gold" /> {label}
              </li>
            ))}
          </ul>
          <p className="mt-6 rounded-lg bg-slate-100 px-4 py-3 text-xs text-muted-foreground">
            La connexion sécurisée sera activée prochainement pour le Directeur et le personnel de
            la DCOP.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center justify-center rounded-md bg-uk-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110"
          >
            Retour au Service Public
          </Link>
        </div>
      </div>
    </div>
  );
}
