import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PROJECT_ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const DATA_PATH = path.join(PROJECT_ROOT, "data", "bibliotheque.json");

const normalizeTag = (t) =>
  String(t || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const uniquePush = (arr, value) => {
  const v = String(value || "").trim();
  if (!v) return;
  if (arr.includes(v)) return;
  arr.push(v);
};

const buildBullets = (tags, categorie) => {
  const t = new Set((Array.isArray(tags) ? tags : []).map(normalizeTag));
  const out = [];

  if (t.has("effectuation")) {
    uniquePush(out, "Apprendre à avancer sans prédire : partir des moyens disponibles et sécuriser des engagements progressifs.");
  }
  if (t.has("incertitude")) {
    uniquePush(out, "Mieux décider dans l'incertitude : limiter la perte acceptable et privilégier des choix réversibles.");
  }
  if (t.has("théorie des contraintes")) {
    uniquePush(out, "Identifier la contrainte (goulot) et aligner l'organisation sur ce levier pour accélérer sans chaos.");
  }
  if (t.has("méthode")) {
    uniquePush(out, "Décider sur des faits : mesurer, tester, apprendre, puis standardiser ce qui marche.");
  }
  if (t.has("gestion de projet")) {
    uniquePush(out, "Stabiliser l'exécution : réduire les délais et les frictions en clarifiant priorités et dépendances.");
  }
  if (t.has("marketing")) {
    uniquePush(out, "Clarifier proposition de valeur et messages : vendre plus clairement, sans surpromettre.");
  }
  if (t.has("influence")) {
    uniquePush(out, "Mieux convaincre (et se protéger) : comprendre les leviers de persuasion et leurs biais.");
  }
  if (t.has("biais cognitifs") || t.has("décision")) {
    uniquePush(out, "Améliorer la qualité des décisions : réduire les angles morts et éviter les raisonnements trompeurs.");
  }
  if (t.has("exécution")) {
    uniquePush(out, "Transformer les idées en résultats : installer des routines simples, des métriques et un rythme d'amélioration.");
  }
  if (t.has("stratégie")) {
    uniquePush(out, "Garder un cap net : mieux arbitrer, différencier, et choisir quoi ne pas faire.");
  }

  const cat = String(categorie || "").trim().toLowerCase();
  if (cat === "psychologie") uniquePush(out, "Mieux gérer stress, attention et relations : un avantage direct pour la performance.");
  if (cat === "sociologie" || cat === "humanite") uniquePush(out, "Mieux lire les dynamiques sociales : réputation, pouvoir, normes et récit.");

  // Ensure we always have 3 bullets
  uniquePush(out, "Se donner un cadre simple pour décider, agir, et itérer sans se raconter d'histoires.");
  uniquePush(out, "Réduire les erreurs coûteuses en rendant explicites hypothèses, risques et critères de succès.");
  uniquePush(out, "Construire une entreprise plus robuste : moins de fragilité, plus d'apprentissage et d'optionnalité.");

  return out.slice(0, 3);
};

const main = async () => {
  const data = JSON.parse(await readFile(DATA_PATH, "utf8"));
  const livres = Array.isArray(data?.livres) ? data.livres : [];

  let updated = 0;
  for (const b of livres) {
    const existing = Array.isArray(b.pourquoi_entrepreneur) ? b.pourquoi_entrepreneur.map(String).filter(Boolean) : [];
    if (existing.length >= 3) continue;

    const filled = [...existing];
    const candidates = buildBullets(b.tags, b.categorie);
    for (const bullet of candidates) uniquePush(filled, bullet);
    b.pourquoi_entrepreneur = filled.slice(0, 3);
    updated += 1;
  }

  await writeFile(DATA_PATH, JSON.stringify({ livres }, null, 2) + "\n", "utf8");
  console.log(`done: updated=${updated}`);
};

await main();

