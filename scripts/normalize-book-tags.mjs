import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PROJECT_ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const DATA_PATH = path.join(PROJECT_ROOT, "data", "bibliotheque.json");

const normalizeTag = (tag) =>
  String(tag || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const DROP_TAGS = new Set(["théorie", "entrepreneuriat", "défi", "discours", "concepts", "introduction"]);

const CANONICAL_TAGS = new Set([
  "incertitude",
  "décision",
  "biais cognitifs",
  "intuition",
  "stratégie",
  "effectuation",
  "exécution",
  "gestion de projet",
  "théorie des contraintes",
  "marketing",
  "influence",
  "psychologie",
  "langage",
  "société",
  "technologie",
  "innovation",
  "sérendipité",
  "synchronicité",
  "éthique",
  "méthode",
]);

const TAG_ALIASES = new Map([
  // incertitude
  ["hasard", "incertitude"],
  ["chance", "incertitude"],
  ["imprévisibilité", "incertitude"],
  ["événements rares", "incertitude"],
  ["probabilités", "incertitude"],
  ["risque", "incertitude"],
  ["chaos", "incertitude"],
  ["résilience", "incertitude"],
  ["incertitude", "incertitude"],

  // décision
  ["décision", "décision"],

  // biais cognitifs
  ["biais cognitifs", "biais cognitifs"],
  ["heuristiques", "biais cognitifs"],
  ["cognition", "biais cognitifs"],

  // intuition
  ["intuition", "intuition"],

  // stratégie
  ["stratégie", "stratégie"],
  ["business", "stratégie"],

  // effectuation
  ["effectuation", "effectuation"],
  ["l'effectuation", "effectuation"],

  // exécution
  ["exécution", "exécution"],
  ["execution", "exécution"],
  ["management", "exécution"],
  ["production", "exécution"],
  ["effectuation (thème)", "effectuation"],

  // théorie des contraintes
  ["théorie des contraintes", "théorie des contraintes"],

  // gestion de projet
  ["gestion de projet", "gestion de projet"],
  ["planification", "gestion de projet"],

  // marketing / marque
  ["marketing", "marketing"],
  ["différenciation", "marketing"],
  ["branding", "marketing"],
  ["marque", "marketing"],
  ["identité", "marketing"],

  // influence / psychologie
  ["influence", "influence"],
  ["manipulation", "influence"],
  ["psychologie sociale", "influence"],
  ["pouvoir", "influence"],
  ["domination", "influence"],

  ["psychologie", "psychologie"],
  ["passions", "psychologie"],
  ["émotions", "psychologie"],
  ["développement personnel", "psychologie"],
  ["coaching", "psychologie"],

  // langage / sémiotique
  ["langage", "langage"],
  ["communication", "langage"],
  ["sémiotique", "langage"],
  ["sémiologie", "langage"],
  ["signes", "langage"],

  // société
  ["société", "société"],
  ["humanité", "société"],
  ["histoire", "société"],
  ["civilisation", "société"],
  ["politique", "société"],
  ["fédéralisme", "société"],
  ["subsidiarité", "société"],
  ["actualité", "société"],
  ["idées reçues", "société"],
  ["sociologie", "société"],
  ["champ social", "société"],

  // technologie
  ["technologie", "technologie"],
  ["futur", "technologie"],
  ["transhumanisme", "technologie"],
  ["réseaux", "technologie"],
  ["information", "technologie"],

  // innovation / sérendipité
  ["innovation", "innovation"],
  ["découverte", "innovation"],
  ["recherche", "innovation"],
  ["sérendipité", "sérendipité"],

  // synchronicité
  ["synchronicité", "synchronicité"],
  ["coïncidence", "synchronicité"],
  ["sens", "synchronicité"],

  // éthique
  ["éthique", "éthique"],
  ["responsabilité", "éthique"],

  // méthode
  ["science", "méthode"],
  ["épistémologie", "méthode"],
  ["connaissance", "méthode"],
  ["logique", "méthode"],
  ["raisonnement", "méthode"],
  ["simplicité", "méthode"],
]);

const canonicalizeTag = (tag) => {
  const t = normalizeTag(tag);
  if (!t) return "";
  if (DROP_TAGS.has(t)) return "";
  if (CANONICAL_TAGS.has(t)) return t;
  const mapped = TAG_ALIASES.get(t) || "";
  return mapped && CANONICAL_TAGS.has(mapped) ? mapped : "";
};

const uniqueTags = (tags) => {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(tags) ? tags : []) {
    const t = canonicalizeTag(raw);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
};

const main = async () => {
  const raw = await readFile(DATA_PATH, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data?.livres)) throw new Error("Invalid bibliotheque.json");

  for (const book of data.livres) {
    book.tags = uniqueTags(book.tags);
  }

  await writeFile(DATA_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("updated tags in data/bibliotheque.json");
};

await main();
