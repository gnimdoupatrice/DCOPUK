<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture

- Portail DCOP à deux onglets : la vitrine publique « Service Public » vit sur `/` (src/routes/index.tsx), l'espace « Service Privé » sur `/service-prive` (placeholder noindex en attendant l'authentification). Le header partagé ne contient que le logo et les deux onglets, via `src/components/dcop/SiteHeader.tsx`; le footer institutionnel bleu `#223ea4` vit dans `UkFooter.tsx`, conformément au site mère.
- Les 5 cartes « Accès rapides » redirigent en externe vers les pages officielles univkara.tg (`target="_blank" rel="noopener noreferrer"`) — ne jamais dupliquer ces contenus en interne, et ne jamais réintroduire de section Actualités/Opportunités (exclue par le cahier des charges).


- L'Espace Privé (`/service-prive`, ssr:false) utilise le projet Supabase externe de l'utilisateur via `src/lib/supabase.ts` (clé publishable) ; le schéma vit dans `supabase/schema.sql` et doit être exécuté manuellement dans le tableau de bord Supabase, car l'agent n'a pas accès à cette base.
- Les règles de statut des conventions (alerte = date+heure choisies par le Directeur, urgence < 60 j ; aucune règle des 5 mois) sont centralisées dans `src/lib/conventions.ts` — à modifier là uniquement.
- La fiche détaillée, les actions du Directeur (avenant, archivage, modification, suppression) et la gestion des PDF vivent dans `src/components/dcop/ConventionDrawer.tsx` ; chaque action est tracée dans la table `convention_historique` pour garder un historique.
- L'alarme critique (boucle sonore, bannière, résumé « J'ai pris acte ») vit dans `src/components/dcop/CriticalAlarm.tsx` : déclenchée à la date+heure d'alerte de chaque convention, jamais pour les expirées ; fichier perso optionnel `public/alarme.mp3`.
- PWA : manifeste statique `public/manifest.webmanifest`, SW généré par vite-plugin-pwa (outDir `dist/client`) et enregistré uniquement via `src/lib/pwa.ts` (bloqué en aperçu/dev) — ne jamais écrire de sw.js à la main.
