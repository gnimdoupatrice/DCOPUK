# Activation des alertes e-mail DCOP

L’envoi reste sur le service Resend déjà utilisé par le projet.

1. Exécuter le bloc « Alertes e-mail : reprise par destinataire » à la fin de `schema.sql` sur la base externe. Les tables `convention_points_focaux` et la colonne `emails_alerte` doivent également exister.
2. Configurer côté serveur `DCOP_SUPABASE_SERVICE_ROLE_KEY`, `ALERTES_CRON_SECRET`, `RESEND_API_KEY` et `RESEND_FROM_EMAIL`. Cette dernière contient seulement une adresse d’expédition sur un domaine vérifié dans Resend. L’adresse de test `onboarding@resend.dev` est refusée. Ne jamais mettre les clés privées dans le navigateur.
3. Publier l’application puis configurer le planificateur existant pour appeler `POST /api/public/alertes-email` avec `Authorization: Bearer <ALERTES_CRON_SECRET>`. Aucun appel planifié n’est créé par cette modification. Un appel toutes les minutes permet une précision à la minute, pas à la seconde.
4. Vérifier une convention dédiée : Direction, partenaire et point focal coché. Contrôler dans Resend les trois envois, puis relancer : aucun nouvel envoi réussi ne doit se répéter. Une adresse non assignée ne doit rien recevoir.

La Direction est traitée en premier. Chaque destinataire reçoit un message distinct, sans divulgation des autres adresses. Seuls les envois acceptés par Resend sont mémorisés ; cela ne prouve pas la réception dans la boîte du destinataire. Une erreur retourne 503 avec des compteurs uniquement, permettant une reprise par le planificateur.

Les marqueurs historiques sont conservés uniquement pour éviter de réenvoyer à la Direction une ancienne alerte. Les partenaires et les points focaux manquants peuvent encore recevoir cette alerte tant que la convention est active.

Les clés d’idempotence Resend protègent les tentatives concurrentes pendant sa fenêtre de 24 heures. Si Resend accepte un message mais que l’écriture du reçu échoue plus de 24 heures, un doublon reste possible : surveiller les erreurs et rétablir rapidement l’accès à la base.

L’agent n’a pas accès à la base externe ni à la configuration d’envoi. L’application réelle du script, la planification et la livraison restent à confirmer après configuration.