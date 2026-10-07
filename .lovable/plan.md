# E-mails d'alerte automatiques (Resend)

## Déjà terminé
- Icône horloge en colonne « Préavis & Alerte » pour modifier ou prolonger un report. La modification est inscrite dans l'historique.
- Rattrapage sonore à la connexion : chaque alerte dépassée sans action sonne en premier, en commençant par la plus ancienne. Le point de situation ne s'affiche qu'une fois toutes les alertes reportées ou arrêtées.
- Resend est connecté au projet.

## Ce qui reste à faire
Envoyer un e-mail à beyeliakougnimdoupatrice13@gmail.com (expéditeur onboarding@resend.dev) :
- à l'heure programmée de l'alerte (H) ;
- à l'heure de chaque report ;
- une seule fois par alerte, sans doublon ;
- même si personne n'a le portail ouvert.

## Fonctionnement
```text
Toutes les 5 min : planificateur de votre base
      -> adresse sécurisée du portail (/api/public/alertes-email)
      -> lit les conventions en vigueur dont l'heure H ou l'heure de report est atteinte
      -> e-mail envoyé via Resend
      -> enregistre la date et l'heure de l'envoi (anti-doublon)
```

## Ce dont j'aurai besoin de votre part
1. **La clé « service_role » de votre base**, saisie dans un formulaire sécurisé. Le serveur en a besoin pour lire les conventions sans session ouverte.
2. **Un mot de passe interne**, que je génère moi-même. Il protège l'adresse d'envoi contre les appels extérieurs.
3. **Un script SQL à exécuter une seule fois** dans votre tableau de bord. Je le fournis prêt à copier. Il ajoute :
   - deux colonnes `email_alerte_envoye_pour` et `email_report_envoye_pour` (anti-doublon) ;
   - l'appel automatique toutes les 5 minutes.

## Limite à connaître
Avec l'expéditeur onboarding@resend.dev, Resend ne livre qu'à l'adresse du titulaire du compte Resend. Pour écrire à d'autres destinataires, il faudra un domaine vérifié (par exemple univkara.tg).

## Détails techniques
- `src/routes/api/public/alertes-email.ts` : contrôle du jeton `Authorization: Bearer <ALERTES_CRON_SECRET>`, client admin créé dans le gestionnaire, envoi par la passerelle Resend.
- Un e-mail part si `moment de référence <= maintenant` et que la colonne anti-doublon ne vaut pas déjà ce moment. La colonne est mise à jour après chaque envoi réussi.
- Conventions archivées, expirées ou arrêtées définitivement : aucun envoi.
- Ajout du script dans `supabase/schema.sql` (colonnes + `pg_cron` / `pg_net`).
