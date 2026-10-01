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
- Les règles de statut des conventions (seuils J-150 / J-60) sont centralisées dans `src/lib/conventions.ts` — à modifier là uniquement.
