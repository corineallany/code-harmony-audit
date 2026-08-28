# COM ICC Le Mans — V1 consolidée et sécurisée

Date de gel : 28 août 2026
Commit de référence : 69ffbc77737b4b55b6718701f7af3278742768b7
Branche de conservation : release/v1-consolidee-2026-08-28

Cette branche constitue le point de restauration de la V1 consolidée après les corrections transversales d’août 2026.

## Principes fonctionnels figés
- Tous les membres voient l’existence des modules ; les actions restent gouvernées par les rôles, périmètres et permissions.
- Les données sensibles restent masquées hors des droits autorisés, même lorsqu’un module est visible en consultation/découverte.
- Les équipiers peuvent demander un remplacement ou un renfort sans modifier directement l’organisation.
- Les évaluations sont rattachées au bon pôle/fonction ; un membre multi-pôles est évalué distinctement dans chaque pôle.
- Un pôle peut avoir plusieurs référents ; la contribution à l’évaluation ne doit pas créer plusieurs évaluations officielles identiques.
- Les listes de personnes évaluables sont limitées au périmètre autorisé.
- La création des programmes comporte une protection anti-doublon/idempotence côté application et base.
- Les doubles affectations sont des conflits signalés mais non bloquants.
- Les statuts provisoires des indisponibilités ne doivent pas encombrer la sélection opérationnelle ; disponible/indisponible est la lecture utile.
- Vie d’équipe couvre anniversaires, propositions, sondages, communions fraternelles/événements et caisse fraternelle.
- La caisse fraternelle vise une transparence globale avec confidentialité nominative et des montants selon les droits ; toute entrée/dépense/correction doit être tracée.
- Les photos utilisées dans l’application peuvent être recadrées/ajustées selon les écrans concernés.
- L’application est installable/ajoutable sur l’écran d’accueil mobile avec l’identité COM ICC Le Mans.

## Règle de maintenance
Toute évolution postérieure doit être développée sans modifier cette branche de conservation. En cas de régression majeure, cette branche sert de référence fonctionnelle et technique pour revenir à l’état consolidé.