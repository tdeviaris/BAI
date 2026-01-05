import { readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";

const PROJECT_ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");

const DATA_PATH = path.join(PROJECT_ROOT, "data", "bibliotheque.json");
const PAGES_DIR = path.join(PROJECT_ROOT, "pages");

const slugify = (input) => {
  const base = String(input || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return base || "livre";
};

const normalizeTag = (tag) =>
  String(tag || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const uniqueTags = (tags) => {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(tags) ? tags : []) {
    const t = normalizeTag(raw);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
};

const fileExists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const fetchJson = async (url) => {
  const resp = await fetch(url, { headers: { "user-agent": "BAI-book-pages-generator/1.0" } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.json();
};

const wikiSearch = async ({ lang, query, limit = 5 }) => {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", query);
  url.searchParams.set("srlimit", String(limit));
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  const data = await fetchJson(url.toString());
  const results = Array.isArray(data?.query?.search) ? data.query.search : [];
  return results.map((r) => String(r?.title || "")).filter(Boolean);
};

const wikiSummary = async ({ lang, title }) => {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const data = await fetchJson(url);
  const extract = data?.extract ? String(data.extract) : "";
  const pageUrl = data?.content_urls?.desktop?.page ? String(data.content_urls.desktop.page) : "";
  return { extract, pageUrl };
};

const normalizeLoose = (input) =>
  String(input || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const tokenizeTitle = (input) => {
  const stop = new Set([
    "le",
    "la",
    "les",
    "un",
    "une",
    "des",
    "du",
    "de",
    "d",
    "et",
    "en",
    "pour",
    "a",
    "au",
    "aux",
    "l",
    "vol",
    "volume",
    "tome",
  ]);
  return normalizeLoose(input)
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => (t.length >= 3 || /^\d+$/.test(t)) && !stop.has(t));
};

const titleMatchScore = (bookTitle, pageTitle) => {
  const bookTokens = tokenizeTitle(bookTitle);
  if (bookTokens.length === 0) return { score: 0, matches: 0, tokens: 0 };
  const page = normalizeLoose(pageTitle);
  let score = 0;
  let matches = 0;
  for (const token of bookTokens) {
    if (!page.includes(token)) continue;
    matches += 1;
    score += token.length >= 6 ? 3 : 2;
  }
  if (bookTokens.length === 1 && score > 0) score += 2;
  return { score, matches, tokens: bookTokens.length };
};

const findWikipedia = async ({ title, author }) => {
  const queries = [
    `${title} ${author}`.trim(),
    `${title} (livre)`,
    `${title} livre`,
    `${title} (book)`,
    `${title} book`,
  ];

  for (const lang of ["fr", "en"]) {
    for (const query of queries) {
      try {
        const candidates = await wikiSearch({ lang, query, limit: 5 });
        if (candidates.length === 0) continue;

        const scored = candidates
          .map((pageTitle) => ({ pageTitle, ...titleMatchScore(title, pageTitle) }))
          .sort((a, b) => b.score - a.score);

        const best = scored[0];
        if (!best || best.score < 2) continue;
        if (best.tokens >= 2 && best.matches < 2) continue;

        const { extract, pageUrl } = await wikiSummary({ lang, title: best.pageTitle });
        if (!pageUrl) continue;
        return { lang, pageTitle: best.pageTitle, extract, pageUrl };
      } catch {
        // ignore and try next query
      }
    }
  }

  return null;
};

const whyEntrepreneur = ({ categorie, tags }) => {
  const category = String(categorie || "").trim().toLowerCase();
  const t = uniqueTags(tags);

  const base = {
    hasard: [
      "Mieux décider quand l'incertitude domine : protéger le downside, éviter les paris irréversibles.",
      "Raisonner en probabilités (plutôt qu'en histoires) pour prioriser, investir, et mesurer.",
      "Construire des systèmes et des habitudes qui résistent aux chocs et tirent parti de la volatilité.",
    ],
    humanite: [
      "Prendre de la hauteur sur les dynamiques humaines et technologiques qui transforment les marchés.",
      "Éclairer des choix produit/positionnement en comprenant les forces sociales (récits, croyances, institutions).",
      "Développer une pensée stratégique long-terme (au-delà de l'exécution court-terme).",
    ],
    sociologie: [
      "Mieux lire les jeux de pouvoir, de réputation et de légitimité (marchés, médias, organisations).",
      "Comprendre comment se construit la valeur symbolique : utile pour le positionnement et la marque.",
      "Éviter des erreurs d'organisation en distinguant règles affichées et incitations réelles.",
    ],
    semiotique: [
      "Clarifier le message : comprendre comment les signes, récits et codes produisent du sens.",
      "Améliorer marketing/brand/UX en travaillant sur la perception, pas seulement sur les features.",
      "Créer des communications plus cohérentes (promesse, preuves, ton, identité).",
    ],
    psychologie: [
      "Détecter biais cognitifs et angles morts : meilleur jugement en produit, recrutement, vente et stratégie.",
      "Comprendre influence et persuasion (avec garde-fous éthiques) pour négocier et convaincre.",
      "Mieux concevoir des processus de décision et des tests (moins d'intuition non vérifiée).",
    ],
    philosophie: [
      "Structurer sa pensée critique : distinguer connaissance, croyance, preuve, et hypothèse.",
      "Décider plus vite avec des heuristiques (simplicité, falsification, élimination du superflu).",
      "Garder un cap méthodologique : mieux apprendre, mieux expérimenter, mieux arbitrer.",
    ],
    management: [
      "Renforcer l'exécution : identifier contraintes, goulots et leviers qui pilotent le système.",
      "Accélérer sans chaos : planifier, livrer, et améliorer en continu avec des règles simples.",
      "Aligner équipe et objectifs via métriques, priorités nettes et décisions réversibles.",
    ],
  };

  const bullets = (base[category] || base.management).slice();
  const tagHint =
    t.includes("marketing") || t.includes("branding") || t.includes("marque")
      ? "Bonus : utile pour améliorer ton acquisition et ton positionnement."
      : t.includes("gestion de projet") || t.includes("planification")
        ? "Bonus : utile pour réduire les délais et stabiliser l'exécution."
        : t.includes("entrepreneuriat") || t.includes("stratégie")
          ? "Bonus : utile pour clarifier stratégie et arbitrages."
          : null;

  if (tagHint) bullets[2] = tagHint;
  return bullets.slice(0, 3);
};

const pageTemplate = ({ bd, titre, resume_court }) => `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(titre)} — The Entrepreneur Whisperer</title>
    <meta name="description" content="${escapeHtml(resume_court || `Présentation du livre ${titre}.`)}" />
    <link rel="icon" type="image/png" href="../img/founder_hacks_compass_refined_v2_1024.png" />
    <link rel="stylesheet" href="../assets/styles.css" />
  </head>
  <body data-page="book-detail" data-book="${escapeHtml(bd)}">
    <a class="skipLink" href="#contenu">Aller au contenu</a>

    <header class="siteHeader" data-surface="page">
      <nav class="nav" aria-label="Menu principal">
        <a class="brand" href="../index.html" aria-label="The Entrepreneur Whisperer (Accueil)">
          <img
            class="brandMark"
            src="../img/founder_hacks_compass_refined_v4_1024.png"
            alt=""
            width="34"
            height="34"
            loading="eager"
          />
          <span class="brandText">The Entrepreneur Whisperer</span>
        </a>

        <button class="navToggle" type="button" aria-expanded="false" aria-controls="navPanel">
          <span class="navToggleIcon" aria-hidden="true"></span>
          <span class="srOnly">Ouvrir le menu</span>
        </button>

        <div class="navPanel" id="navPanel">
          <a class="navLink" href="../index.html">Accueil</a>
          <a class="navLink" href="assistant-ia.html">Assistant IA</a>
          <a class="navLink" href="conseils.html">Conseils</a>
          <a class="navLink isActive" href="bibliotheque.html">Bibliothèque</a>
          <a class="navLink" href="a-propos.html">À propos</a>
        </div>
      </nav>

      <section class="pageHero" id="contenu" style="padding: 1rem 0;">
        <div class="container"></div>
      </section>
    </header>

    <main class="main">
      <section class="section" style="padding-top: 1rem;">
        <div class="container">
          <div id="bookDetailMount"></div>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div class="container footerRow">
        <p class="muted">© <span data-year></span> The Entrepreneur Whisperer</p>
        <a class="footerLegal" href="mentions-legales.html">Mentions légales</a>
      </div>
    </footer>

    <script src="../assets/main.js" defer></script>
  </body>
</html>
`;

const escapeHtml = (text) =>
  String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const main = async () => {
  const raw = await readFile(DATA_PATH, "utf8");
  const data = JSON.parse(raw);
  const livres = Array.isArray(data?.livres) ? data.livres : [];

  const updated = [];

  for (const book of livres) {
    const titre = String(book.titre || "").trim();
    const auteur = String(book.auteur || "").trim();
    const existingBd = book.bd ? String(book.bd) : "";
    const isCustom = existingBd && (await fileExists(path.join(PAGES_DIR, existingBd)));

    const tags = uniqueTags(book.tags);
    const bd = existingBd || `${slugify(titre)}.html`;
    const pagePath = path.join(PAGES_DIR, bd);

    if (!isCustom && !(await fileExists(pagePath))) {
      const html = pageTemplate({ bd, titre, resume_court: book.resume_court });
      await writeFile(pagePath, html, "utf8");
      console.log(`+ page ${path.relative(PROJECT_ROOT, pagePath)}`);
    }

    let url_wikipedia = "";
    const found = await findWikipedia({ title: titre, author: auteur });
    if (found?.pageUrl) {
      url_wikipedia = found.pageUrl;
      console.log(`wiki ${titre} -> ${url_wikipedia}`);
    }

    const pourquoi_entrepreneur = book.pourquoi_entrepreneur || whyEntrepreneur({ ...book, tags });

    updated.push({
      titre: book.titre,
      auteur: book.auteur,
      image: book.image,
      resume_court: book.resume_court,
      tags,
      resume_long: book.resume_long,
      url_amazon: book.url_amazon,
      categorie: book.categorie,
      bd,
      ...(url_wikipedia ? { url_wikipedia } : {}),
      ...(pourquoi_entrepreneur ? { pourquoi_entrepreneur } : {}),
    });
  }

  const out = JSON.stringify({ livres: updated }, null, 2) + "\n";
  await writeFile(DATA_PATH, out, "utf8");
  console.log(`updated ${path.relative(PROJECT_ROOT, DATA_PATH)}`);
};

await main();
