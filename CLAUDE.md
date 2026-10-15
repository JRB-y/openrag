# CLAUDE.md — OpenRag

## Contexte

OpenRag est un **projet éducatif** pour comprendre la technologie RAG en profondeur.
Ce n'est **pas** une application destinée à la production. L'objectif est que je comprenne chaque brique, pas d'obtenir le code le plus robuste possible.

- Spécifications fonctionnelles et techniques : `DOCS.md`
- Feuille de route et suivi : `PROGRESSION.md`
- Stack : Node.js 22 / TypeScript, pnpm workspaces (voir `DOCS.md` §3)
- Langue de nos échanges : **français**. Code, commentaires et commits : **anglais**.

---

## Workflow obligatoire

À chaque session, suis ces étapes dans l'ordre :

1. **Lire** `PROGRESSION.md`.
2. **Identifier** la première tâche non cochée (`- [ ]`) en partant du haut. C'est la seule tâche à traiter.
   - Plusieurs cases très liées et triviales (ex. créer 3 dossiers vides) peuvent être traitées ensemble.
   - Ne jamais commencer une tâche d'une étape suivante tant que l'étape en cours n'est pas terminée.
3. **Annoncer** en une phrase la tâche que tu vas réaliser.
4. **Réaliser** la tâche en respectant les principes de code ci-dessous.
5. **Vérifier** que ça fonctionne : `pnpm typecheck`, `pnpm lint`, tests concernés, ou exécution manuelle.
6. **Mettre à jour** `PROGRESSION.md` (voir section dédiée).
7. **Commiter** (voir section Git).
8. **Expliquer** ce qui a été fait (voir section Explication).
9. **S'arrêter** et attendre mon feu vert avant la tâche suivante.

Si une tâche est bloquée, ambiguë ou te semble inutile pour un projet éducatif, **demande-moi** avant d'agir au lieu de deviner.

---

## Principes de code

**La simplicité prime sur tout le reste.** Le code doit pouvoir être lu et compris par un développeur qui découvre le RAG.

- Écris le code le plus simple qui remplit la tâche. Pas d'abstraction « au cas où ».
- Pas de pattern d'architecture superflu (repository, factory, DI container, couches multiples…) sans besoin concret.
- Préfère des fonctions courtes et explicites à des classes.
- Un fichier = une responsabilité claire. Les noms de fichiers et de fonctions doivent suffire à comprendre leur rôle.
- Pas de dépendance nouvelle si quelques lignes de code suffisent. Toute dépendance ajoutée doit être open source, reconnue et maintenue.
- TypeScript strict, mais sans gymnastique de types : des types simples et lisibles.
- Gestion d'erreurs : claire et utile, sans sur-protection. Un message d'erreur explicite vaut mieux qu'un système de retry complexe.
- Commente le **pourquoi** des parties propres au RAG (chunking, RRF, reranking, prompts), pas le **quoi** évident.
- Si une tâche de `PROGRESSION.md` te semble trop complexe pour l'objectif éducatif, propose une version simplifiée avant de l'implémenter.

---

## Tests

Écris des tests **uniquement pour les parties critiques**, celles où un bug fausserait les résultats du RAG sans erreur visible :

- Parsers (extraction du texte, conservation de la structure)
- Chunking (taille, découpage, fil d'Ariane, tableaux intacts)
- Recherche hybride et fusion RRF
- Extraction et mapping des citations

Pas de tests pour : routes CRUD simples, configuration, UI, glue code.
Framework : **Vitest**. Tests courts, lisibles, un comportement par test.

---

## PROGRESSION.md : document vivant

Après chaque tâche :

- Cocher la ou les cases réalisées (`- [x]`).
- Si l'implémentation diffère du plan, mettre à jour la tâche pour refléter ce qui a réellement été fait.
- Si une nouvelle tâche nécessaire apparaît, l'ajouter au bon endroit.
- Quand une étape est entièrement terminée, vérifier son critère de validation ✅.
- Ajouter une ligne dans le tableau **Journal** : date, étape, résumé en une ligne et décision notable éventuelle.

Ne jamais supprimer une tâche non réalisée sans mon accord.

---

## Git

- Utiliser `git` pour les commits et la **CLI `gh`** pour tout ce qui concerne GitHub (repo, PR, issues).
- **Un commit par tâche**, incluant le code et la mise à jour de `PROGRESSION.md`.
- Format **Conventional Commits**, en anglais, à l'impératif, sujet ≤ 72 caractères :

  ```
  <type>(<scope>): <description>
  ```

  - Types : `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`
  - Scopes : `api`, `worker`, `web`, `core`, `db`, `infra`, `repo`
  - Exemples :
    - `chore(repo): initialize pnpm monorepo`
    - `feat(core): add structure-aware markdown chunker`
    - `test(core): cover RRF fusion edge cases`

- **Ne jamais ajouter de trailer `Co-Authored-By`** ni aucune mention de Claude ou d'un outil d'IA dans les commits.
- Ne jamais commiter de secrets (`.env`, clés API) ni le dossier `storage/`.
- Ne pas `push` ni ouvrir de PR sans que je le demande.
- Ne jamais réécrire l'historique (`--force`, `rebase` sur des commits poussés).

---

## Explication de fin de tâche

À la fin de chaque tâche, explique-moi en français, de façon concise et pédagogique :

1. **Ce qui a été fait** : en 2 à 4 phrases.
2. **Le concept RAG derrière** (si pertinent) : pourquoi cette brique existe et quel problème elle résout.
3. **Les fichiers clés** à lire, avec leur rôle en une ligne.
4. **Comment le tester** moi-même : la commande ou la manipulation exacte.
5. **Les choix faits** : les alternatives écartées et pourquoi, en une ou deux lignes.
6. **La prochaine tâche** dans `PROGRESSION.md`.

Va droit au but : pas de récapitulatif de chaque commande lancée.

---

## Commandes utiles

```bash
pnpm infra:up        # Postgres, Redis, Ollama
pnpm dev             # API + worker + web
pnpm typecheck
pnpm lint
pnpm test
pnpm db:migrate
pnpm db:reset
```

> Ces scripts sont créés au fil des étapes 0 à 2. S'ils n'existent pas encore, c'est normal.