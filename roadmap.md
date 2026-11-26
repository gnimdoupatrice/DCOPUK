# Dernière phase DCOP

## Tâche 3.2 — Corbeille réversible

- [x] Brancher la mise en corbeille dans le registre et la fiche détaillée.
- [x] Exclure la corbeille du cockpit, des alarmes et des e-mails.
- [x] Ajouter restauration, doublons stricts et traitement des alertes échues.
- [x] Ajouter les colonnes SQL et la purge automatique après 30 jours.
- [x] Exécuter les 49 tests et vérifier la compilation.
- [ ] Activer la purge sur la base externe — exécuter `supabase/schema.sql` puis `supabase/horloge-alertes.sql` avec les valeurs réelles.
- [ ] Vérifier suppression, restauration et doublons en session réelle — aucun compte DCOP de test disponible.

## Alertes e-mail

- [x] Compléter les alertes partenaires et points focaux, avec envois isolés et suivi par destinataire.
- [x] Ajouter les tests des règles d’envoi et vérifier les écrans accessibles.
- [x] Documenter la configuration et le script à appliquer sur la base externe.
- [ ] Activer et vérifier la livraison réelle — attend le script sur la base externe, les clés d’envoi, un expéditeur vérifié et la planification.
- [ ] Vérifier les formulaires et fiches en session réelle — aucun accès de test à la connexion externe disponible.