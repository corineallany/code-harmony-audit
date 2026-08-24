# Restauration fidèle de l'identité visuelle existante

## Ce que j'ai relevé dans le `index.html` fourni (état final V97)

**Couleurs officielles (tailwind.config du fichier)**
- `iccViolet #4c1d95`, `iccVioletHover #3b0764`
- `iccYellow #eab308`, `iccYellowHover #ca8a04`
- `iccBlue #1d4ed8`, `iccGreen #059669`
- Fond application : `bg-slate-50`, texte `slate-800`, police système sans-serif, titres en `font-black`
- Dégradé héro : `linear-gradient(135deg,#4c1d95,#1e40af)`
- Cartes : blanc, bordure `#e2e8f0`, rayon 18px, ombre légère

**En-tête (sticky, violet plein)**
- Pastille jaune « ICC » + « LE MANS » + baseline « Communication • Organisation • Service »
- À droite : cloche 🔔 avec badge rouge, engrenage ⚙️ Paramètres, bouton compte (avatar + libellé)

**Accueil — bloc héro**
- Pastille « ⛪ ICC Le Mans »
- Titre : « Servir avec excellence, communiquer avec intention. »
- Sous-titre : « Un espace commun pour organiser les programmes, connaître l'équipe, suivre les sollicitations et coordonner la communication. »
- Deux cartes blanches de versets côte à côte, référence en petit violet majuscule + texte en semi-gras :
  - Matthieu 6:33 — « Cherchez premièrement le royaume et la justice de Dieu; et toutes ces choses vous seront données par-dessus. »
  - Hébreux 6:10 — « Car Dieu n'est pas injuste, pour oublier votre travail et l'amour que vous avez montré pour son nom, ayant rendu et rendant encore des services aux saints. »
  - Ces versets restent éditables depuis Paramètres (Identité & accueil), comme aujourd'hui.

**Accueil — grille de menus sous les versets** (grille 1 / 2 / 4 colonnes, cartes 138px mini), ordre exact de l'état final :
Planning · Programmes · Trombinoscope · Sollicitations ponctuelles · En formation · Pôles · Pilotage · Évaluations · Post-service · Disponibilités · Modèles · Recherche · Checklists · Historique · Archives & corbeille · **Nouveau programme** (carte violette, icône jaune ＋) · **Paramètres** (carte ardoise foncée)
Chaque carte : icône émoji, titre `font-black`, description grise, libellés repris mot pour mot.

**Accueil — tableau de bord personnel** (bloc blanc arrondi, placé sous la grille de menus)
- Titre « Tableau de bord » en violet + « Tes informations et services personnels. »
- Bouton « 📅 Mon planning » aligné à droite dans l'en-tête du bloc
- 4 indicateurs cliquables : Sollicitations et programmes en attente 🔔 · Mes services ✅ · Membres en formation 🎓 · Membres actifs maintenant 👥

**Navigation générale**
- Pas de sidebar : navigation par cartes depuis l'accueil, en-tête violet permanent, et bouton « ← Retour » violet en haut de chaque page.
- Chaque page interne : titre `text-2xl font-black text-iccViolet` + phrase d'aide grise + boutons d'action violets.

## Ce que je vais faire

1. Remplacer le thème actuel (bleu nuit / or, Sora + Manrope, sidebar) par les tokens ICC ci-dessus dans `src/styles.css`.
2. Recréer proprement, en composants React uniques : `IccHeader`, `HomeHero` (versets depuis la table de paramètres), `HomeMenuGrid`, `HomeDashboard`, `PageHeader` (titre + retour).
3. Remplacer `AppShell` (sidebar + barre mobile) par le chrome d'origine : en-tête violet sticky + navigation par cartes + retour, responsive mobile/desktop.
4. Adapter toutes les pages déjà reconstruites (planning, programmes, tâches, sollicitations, trombinoscope, pôles, conflits, exports, administration, paramètres, pilotage) à cette charte : titres violets, cartes blanches arrondies, boutons violets/jaunes.
5. Brancher les 4 indicateurs du tableau de bord et « Mon planning » sur les données Supabase (aucun `localStorage` métier).
6. Ajouter les entrées de menu manquantes vers les modules de THE Consolidation (Évaluations, Post-service, Disponibilités, Modèles, Recherche, Checklists, Historique, Archives) dans la même grille, en respectant l'ordre d'origine.

## Ce que je ne touche pas
- Aucun texte, verset, libellé ou intitulé réécrit.
- Aucun ancien script V30/V77/V83/V91 recopié : uniquement des composants propres.
- Aucune donnée supprimée ni migration destructive.

## Note technique
Les couleurs deviennent des tokens sémantiques (`--primary`, `--accent`, `--surface`…) dans `src/styles.css`, valorisés avec les codes ICC exacts, pour éviter les couleurs codées en dur dans les composants.
