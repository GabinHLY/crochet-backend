# L’atelier d’Élise — API

API Express / TypeScript du carnet de crochet : enregistrement des patrons (SQLite) et génération de patrons d’amigurumi à partir de photos (Google Gemini). L’interface est dans le dépôt `crochet-elise-front`.

## Démarrer

Node.js 22.13 ou plus récent (module `node:sqlite`).

```bash
npm install
cp .env.example .env   # puis renseigner GEMINI_API_KEY
npm run dev
```

L’API écoute sur http://localhost:8787 (`PORT`, `HOST`). La base est créée dans `./data/crochet.sqlite` (`DATABASE_PATH`). En production : `npm start`.

## Routes

- `GET /api/status` : état du stockage et disponibilité de l’analyse photo.
- `GET /api/patterns`, `GET|PUT|DELETE /api/patterns/:id`, `POST /api/patterns/migrate` : patrons, avec numéro de révision contre les écritures concurrentes.
- `POST /api/generate-amigurumi` (multipart) : `mainImage`, jusqu’à 3 `extraImages` (côté, dos), `targetHeightCm`, `settings` (JSON : échantillon, fil, préférences). Renvoie l’analyse et le patron.

Si le front est servi depuis un autre domaine, renseigner son adresse dans `CORS_ORIGIN`.

## Analyse photo

La clé `GEMINI_API_KEY` reste côté serveur. Les photographies sont transmises à Google Gemini pour analyse. Si le modèle principal (`GEMINI_MODEL`) est saturé, retiré ou limité (503, 404, 429), le serveur essaie les modèles de `GEMINI_FALLBACK_MODELS` (par défaut `gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash,gemini-3-flash-preview,gemini-3.5-flash-lite`).

Sans clé, la génération n’est disponible qu’en **démonstration**, avec un exemple fixe qui ne correspond pas à la photographie. Une analyse réelle produit une estimation à vérifier avec un échantillon et un essai crocheté.

Pour stabiliser les mesures, `GEMINI_SAMPLES` analyses (5 par défaut) sont lancées en parallèle sur des modèles différents et leur médiane est retenue ; chaque génération consomme donc plusieurs requêtes (l’offre gratuite de Gemini en autorise 20 par jour et par modèle). Gemini décrit les pièces (forme, proportions, affinement, zones de couleur) et leur boîte englobante sur la photo où elles sont le mieux visibles : les photos de côté et de dos permettent de mesurer les pièces cachées de face, comme la queue. Les boîtes cohérentes avec l’estimation remplacent celle-ci, les autres recalent largeurs et longueurs séparément ; une pièce plate cousue sur un volume rond (ventre) est élargie de la courbure que la photo ne montre pas. Le moteur calcule ensuite les tours : boules aux tours droits réalistes, membres affinés régulièrement, oreilles creusées ouvertes, dômes (museau), ovales plats en rond (ventre), changements de couleur au bon tour et quantité de fil par couleur. Formats image : PNG, JPEG, WebP, 12 Mo maximum par fichier.

## Code partagé avec le front

`src/types.ts` et `src/lib/calculations.ts` existent aussi dans le front, ainsi que le schéma de sauvegarde (`src/patternSchema.ts` ici, `patternSchema` dans `src/lib/storage.ts` côté front). **Toute modification de ces fichiers doit être reportée dans les deux dépôts.**

## Vérifications

```bash
npm test
npm run typecheck
npm run lint
```

Tests : calculs des mailles, analyse et génération des pièces, recalage des proportions, fusion des analyses, repli entre modèles Gemini, taille des images, SQLite et routes des patrons.
