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

- Portail DCOP à deux onglets : la vitrine publique « Service Public » vit sur `/` (src/routes/index.tsx), l'espace « Service Privé » sur `/service-prive` (placeholder noindex en attendant l'authentification). Le header (barre supérieure + onglets) est partagé via `src/components/dcop/SiteHeader.tsx`, le footer institutionnel via `UkFooter.tsx`.
- Les 5 cartes « Accès rapides » redirigent en externe vers les pages officielles univkara.tg (`target="_blank" rel="noopener noreferrer"`) — ne jamais dupliquer ces contenus en interne, et ne jamais réintroduire de section Actualités/Opportunités (exclue par le cahier des charges).

