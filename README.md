# The Entrepreneur Whisperer

Site statique (HTML/CSS/JS) pour “The Entrepreneur Whisperer”, inspiré de l’esprit visuel très coloré de mindmarket.

## Lancer en local

- Option 1 : ouvrir `index.html` dans un navigateur
- Option 2 (recommandé) :
  - `python3 -m http.server 8080`
  - ouvrir `http://localhost:8080`

## Assistant IA (base de connaissance)

- La source est dans `knowledgebase/` (non versionné).
- Pour générer une version “clean” (Markdown + manifest) à uploader dans une base vectorielle :
  - `python3 scripts/prepare_knowledgebase.py`
  - sortie : `knowledgebase_clean/` (PII redacted par défaut : emails / téléphones)
