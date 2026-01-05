import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";

const PROJECT_ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const DATA_PATH = path.join(PROJECT_ROOT, "data", "bibliotheque.json");
const PAGES_DIR = path.join(PROJECT_ROOT, "pages");

const normalizeLoose = (input) =>
  String(input || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const slugify = (input) => {
  const base = normalizeLoose(input)
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return base || "livre";
};

const fileExists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const openLibrarySearch = async ({ title, author }) => {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("title", title);
  if (author) url.searchParams.set("author", author);
  url.searchParams.set("limit", "8");
  const resp = await fetch(url.toString(), { headers: { "user-agent": "BAI/1.0" } });
  if (!resp.ok) throw new Error(`OpenLibrary HTTP ${resp.status}`);
  return resp.json();
};

const isbn13to10 = (isbn13) => {
  const s = String(isbn13 || "").replace(/[^0-9X]/gi, "");
  if (!/^97[89]\d{10}$/.test(s)) return null;
  const core = s.slice(3, 12); // 9 digits
  let sum = 0;
  for (let i = 0; i < core.length; i++) sum += (10 - i) * Number(core[i]);
  const mod = sum % 11;
  const check = (11 - mod) % 11;
  const checkChar = check === 10 ? "X" : String(check);
  return core + checkChar;
};

const pickIsbn10 = (doc) => {
  const list = Array.isArray(doc?.isbn) ? doc.isbn.map(String) : [];
  const cleaned = list.map((x) => x.replace(/[^0-9X]/gi, "").toUpperCase());
  const isbn10 = cleaned.find((x) => /^[0-9X]{10}$/.test(x));
  if (isbn10) return isbn10;
  const isbn13 = cleaned.find((x) => /^\d{13}$/.test(x));
  if (isbn13) return isbn13to10(isbn13);
  return null;
};

const scoreDoc = (title, doc) => {
  const t = normalizeLoose(title);
  const cand = normalizeLoose(doc?.title || "");
  if (!cand) return 0;
  if (cand === t) return 100;
  let score = 0;
  for (const token of t.split(/\s+/).filter(Boolean)) {
    if (token.length < 4) continue;
    if (cand.includes(token)) score += 8;
  }
  return score;
};

const resolveAmazonUrl = async ({ title, author }) => {
  try {
    const data = await openLibrarySearch({ title, author });
    const docs = Array.isArray(data?.docs) ? data.docs : [];
    if (docs.length === 0) return { url: "", isbn10: "" };
    docs.sort((a, b) => scoreDoc(title, b) - scoreDoc(title, a));
    const best = docs[0];
    const isbn10 = pickIsbn10(best);
    if (!isbn10) return { url: "", isbn10: "" };
    return { url: `https://www.amazon.fr/dp/${isbn10}`, isbn10 };
  } catch {
    return { url: "", isbn10: "" };
  }
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

const list = [
  {
    auteur: "Philippe Silberzahn",
    titre: "Effectuation: Les principes de l’entrepreneuriat pour tous",
    categorie: "management",
    tags: ["effectuation", "stratégie", "incertitude"],
    resume_court: "Les principes de l’effectuation : entreprendre sans prédire, en construisant avec les moyens disponibles.",
    resume_long:
      "Ce livre présente l’effectuation, un mode de pensée observé chez des entrepreneurs expérimentés : partir de ce qu’on a (qui je suis, ce que je sais, qui je connais), avancer par engagements progressifs, et accepter de co-construire l’opportunité avec des parties prenantes. Plutôt que de chercher à prédire un marché incertain, l’approche aide à réduire le risque en limitant la perte acceptable, en itérant et en saisissant les contingences. Une lecture utile pour structurer un projet dans l’incertitude, surtout au démarrage.",
  },
  {
    auteur: "Saras D. Sarasvathy",
    titre: "Effectual Entrepreneurship",
    categorie: "management",
    tags: ["effectuation", "stratégie", "incertitude"],
    resume_court: "La théorie fondatrice de l’effectuation, appliquée à l’action entrepreneuriale.",
    resume_long:
      "Saras Sarasvathy formalise l’effectuation : une logique d’action entrepreneuriale qui privilégie le contrôle sur la prédiction. Le livre explique les principes (perte acceptable, patchwork fou, tirer parti des surprises, pilote dans l’avion) et comment ils se traduisent en décisions concrètes. C’est une base solide pour concevoir des expériences, sécuriser des engagements et avancer sans plan figé.",
  },
  {
    auteur: "W. Edwards Deming",
    titre: "Hors de la crise",
    categorie: "management",
    tags: ["méthode", "exécution", "stratégie"],
    resume_court: "Qualité, système et management : une feuille de route pour transformer durablement l’organisation.",
    resume_long:
      "Deming expose les causes systémiques des problèmes de qualité et de performance, et propose une approche de transformation fondée sur l’amélioration continue, la mesure et le management par le système (plutôt que par la sanction). Pour un entrepreneur, c’est un rappel puissant : on optimise un système, pas des individus isolés, et la qualité est une stratégie, pas un département. Idéal pour structurer l’exécution quand l’équipe grandit.",
  },
  {
    auteur: "W. Edwards Deming",
    titre: "Du nouveau en économie",
    categorie: "management",
    tags: ["méthode", "stratégie", "exécution"],
    resume_court: "La “System of Profound Knowledge” : comprendre variation, système, connaissance et psychologie.",
    resume_long:
      "Dans cet ouvrage, Deming synthétise sa pensée autour d’un cadre : comprendre les systèmes, la variation, la théorie de la connaissance et la psychologie. Ce cadre sert à diagnostiquer, décider et améliorer sans tomber dans les explications simplistes. Pour un entrepreneur, c’est un antidote aux décisions basées sur des anecdotes : on apprend à mesurer, à distinguer bruit et signal, et à construire des boucles d’amélioration.",
  },
  {
    auteur: "Eliyahu M. Goldratt",
    titre: "Un an pour sauver l’Entreprise",
    categorie: "management",
    tags: ["théorie des contraintes", "exécution", "stratégie"],
    resume_court: "Appliquer la Théorie des Contraintes aux systèmes d’information et aux organisations complexes.",
    resume_long:
      "Goldratt applique l’esprit de la Théorie des Contraintes à des environnements où les goulets ne sont pas seulement physiques : priorités, flux d’information, dépendances, politiques internes. Le livre insiste sur le fait qu’une optimisation locale peut dégrader la performance globale. Pour un entrepreneur, c’est très utile dès qu’il y a plusieurs équipes et une complexité croissante : clarifier la contrainte, la protéger, et aligner tout le système dessus.",
  },
  {
    auteur: "Eliyahu M. Goldratt",
    titre: "Isn’t It Obvious?",
    categorie: "management",
    tags: ["théorie des contraintes", "exécution", "stratégie"],
    resume_court: "La Théorie des Contraintes appliquée à la distribution et à la chaîne d’approvisionnement.",
    resume_long:
      "Ce roman de management transpose la Théorie des Contraintes dans le monde de la distribution : stocks, disponibilité, ruptures, et flux. Il montre comment des règles simples, centrées sur la contrainte et la variabilité, peuvent améliorer service et cash. Pour un entrepreneur, c’est particulièrement pertinent si ton business a un flux (e-commerce, retail, ops) où les stocks et la disponibilité font ou défont l’expérience client.",
  },
  {
    auteur: "Eliyahu M. Goldratt",
    titre: "The Choice (Revised Edition)",
    categorie: "management",
    tags: ["stratégie", "méthode", "décision"],
    resume_court: "Un livre plus personnel : des principes de pensée et de décision, racontés comme un dialogue.",
    resume_long:
      "Goldratt déroule une série de principes pour raisonner clairement : distinguer symptômes et causes, clarifier les objectifs, et éviter les compromis artificiels. C’est moins “opérationnel” que TOC, mais très utile pour un entrepreneur qui doit décider vite dans l’ambiguïté. Le format narratif rend les idées faciles à retenir et à transmettre à une équipe.",
  },
  {
    auteur: "Freddy Ballé, Michael Ballé",
    titre: "The Gold Mine: A Novel of Lean Turnaround",
    categorie: "management",
    tags: ["méthode", "exécution", "stratégie"],
    resume_court: "Un roman pour comprendre le Lean : apprendre à voir le gaspillage et améliorer le flux.",
    resume_long:
      "Ce livre raconte une transformation Lean à travers une histoire, en mettant l’accent sur l’apprentissage terrain, la résolution de problèmes et l’amélioration continue. On y découvre comment rendre visible le travail, réduire les gaspillages et stabiliser le flux. Pour un entrepreneur, c’est un guide pratique pour bâtir une culture d’exécution et d’amélioration, sans surprocesser.",
  },
  {
    auteur: "Freddy Ballé, Michael Ballé",
    titre: "The Lean Manager: A Novel of Lean Transformation",
    categorie: "management",
    tags: ["méthode", "exécution", "psychologie"],
    resume_court: "Manager en mode Lean : coaching, résolution de problèmes, et routines d’amélioration.",
    resume_long:
      "Dans la continuité de The Gold Mine, ce roman met l’accent sur le rôle du manager : développer les personnes, structurer l’apprentissage et installer des routines qui améliorent le système. Pour un entrepreneur, c’est utile quand l’équipe grandit : passer du “faire” au “faire faire”, sans perdre la qualité d’exécution.",
  },
  {
    auteur: "James P. Womack, Daniel T. Jones",
    titre: "Lean Thinking: Banish Waste and Create Wealth in Your Corporation",
    categorie: "management",
    tags: ["méthode", "exécution", "stratégie"],
    resume_court: "Les principes du Lean appliqués à la performance : flux, valeur, et élimination du gaspillage.",
    resume_long:
      "Un classique du Lean : définir la valeur du point de vue client, cartographier le flux, faire circuler, tirer par la demande, et viser la perfection. Pour un entrepreneur, c’est un cadre simple pour améliorer qualité et vitesse sans brûler l’équipe : on optimise le flux et on supprime le gaspillage plutôt que d’ajouter de la pression.",
  },
  {
    auteur: "David Rock",
    titre: "Your Brain at Work",
    categorie: "psychologie",
    tags: ["psychologie", "décision", "exécution"],
    resume_court: "Attention, charge mentale et performance : comment mieux travailler avec ton cerveau.",
    resume_long:
      "David Rock explique comment la charge cognitive, l’attention et la fatigue impactent la performance. Le livre donne des repères concrets pour mieux structurer son travail, prioriser et réduire la surcharge. Pour un entrepreneur, c’est particulièrement utile pour protéger le focus et limiter les décisions dégradées par le stress.",
  },
  {
    auteur: "David Rock",
    titre: "Quiet Leadership",
    categorie: "psychologie",
    tags: ["psychologie", "influence", "exécution"],
    resume_court: "Une approche du leadership basée sur le coaching et la clarté mentale plutôt que la pression.",
    resume_long:
      "Le livre propose un style de management qui aide les personnes à penser plus clairement : poser les bonnes questions, créer les conditions d’insight, et réduire les frictions émotionnelles. Pour un entrepreneur, c’est un levier pour améliorer les conversations difficiles (priorités, performance, feedback) et rendre l’équipe plus autonome.",
  },
  {
    auteur: "Robert B. Cialdini",
    titre: "Influence: Science and Practice",
    categorie: "psychologie",
    tags: ["influence", "biais cognitifs", "marketing"],
    resume_court: "Les mécanismes de persuasion (réciprocité, rareté, preuve sociale…) et comment s’en protéger.",
    resume_long:
      "Cialdini décrit des principes robustes de persuasion et les biais qui les rendent efficaces. Pour un entrepreneur, c’est utile à deux niveaux : construire des messages et des offres plus convaincants, et repérer les manipulations (vente, négociation, partenariats). À utiliser avec un cadre éthique clair.",
  },
  {
    auteur: "Rafi Haladjian",
    titre: "Éloge de l’incertitude",
    categorie: "hasard",
    tags: ["incertitude", "décision", "stratégie"],
    resume_court: "Un regard provocateur sur l’incertitude et nos illusions de maîtrise dans le travail moderne.",
    resume_long:
      "Haladjian propose une réflexion sur l’incertitude et les outils “modernes” qui donnent une impression de contrôle. Pour un entrepreneur, c’est un bon contrepoids : accepter l’inconnu, décider avec information imparfaite, et éviter de confondre production de slides avec création de valeur.",
  },
  {
    auteur: "Daniel H. Pink",
    titre: "Drive: The Surprising Truth About What Motivates Us",
    categorie: "psychologie",
    tags: ["psychologie", "exécution", "éthique"],
    resume_court: "Motivation intrinsèque : autonomie, maîtrise, sens (plutôt que carotte/bâton).",
    resume_long:
      "Pink synthétise des recherches sur la motivation : les systèmes d’incitation peuvent dégrader la performance sur les tâches créatives. À la place, autonomie, maîtrise et sens produisent un engagement durable. Pour un entrepreneur, c’est précieux pour concevoir culture, objectifs et incentives sans casser l’initiative.",
  },
  {
    auteur: "Daniel H. Pink",
    titre: "To Sell Is Human: The Surprising Truth About Moving Others",
    categorie: "management",
    tags: ["marketing", "influence", "décision"],
    resume_court: "Vendre au quotidien : convaincre, négocier, et faire bouger les autres (sans scripts).",
    resume_long:
      "Pink montre que la vente n’est pas réservée aux commerciaux : tout le monde “vend” des idées, des priorités, des choix. Le livre propose des principes pratiques (empathie, clarté, cadence, questions) pour mieux convaincre. Pour un entrepreneur, c’est une base utile pour le go-to-market et le leadership.",
  },
  {
    auteur: "Alfie Kohn",
    titre: "Punished by Rewards",
    categorie: "psychologie",
    tags: ["psychologie", "éthique", "exécution"],
    resume_court: "Pourquoi les récompenses et incentives peuvent nuire à la motivation et à l’apprentissage.",
    resume_long:
      "Kohn critique la logique “récompense/punition” dans l’éducation et le travail : elle favorise le court terme et réduit l’intérêt intrinsèque. Pour un entrepreneur, c’est une lecture utile avant de mettre en place bonus, commissions ou OKR mal calibrés : on y apprend à éviter des effets pervers sur la culture et la qualité.",
  },
  {
    auteur: "Steven D. Levitt, Stephen J. Dubner",
    titre: "Freakonomics",
    categorie: "philosophie",
    tags: ["méthode", "décision", "société"],
    resume_court: "Appliquer des outils d’économie empirique à des questions surprenantes du quotidien.",
    resume_long:
      "Freakonomics popularise une façon de penser : poser des hypothèses, chercher des données, tester des causalités plutôt que raconter des histoires. Pour un entrepreneur, c’est un rappel précieux : mesurer avant de conclure, éviter les corrélations trompeuses, et raisonner en incitations.",
  },
  {
    auteur: "Steven D. Levitt, Stephen J. Dubner",
    titre: "SuperFreakonomics",
    categorie: "philosophie",
    tags: ["méthode", "décision", "société"],
    resume_court: "Suite orientée expérimentation : biais, incitations et solutions contre-intuitives.",
    resume_long:
      "Dans la continuité, le livre met l’accent sur les mécanismes d’incitation et les effets inattendus des politiques et décisions. Pour un entrepreneur, c’est utile pour challenger ses intuitions, concevoir des tests et anticiper des effets secondaires.",
  },
  {
    auteur: "Phil Rosenzweig",
    titre: "The Halo Effect",
    categorie: "management",
    tags: ["biais cognitifs", "décision", "méthode"],
    resume_court: "Pourquoi on attribue le succès à de “bonnes pratiques”… souvent après coup (et à tort).",
    resume_long:
      "Rosenzweig démonte des erreurs classiques d’analyse du succès (halo effect, biais de sélection, récit rétrospectif). Pour un entrepreneur, c’est un vaccin contre les recettes miracles : on apprend à distinguer chance, contexte et causalité, et à construire une stratégie sans copier aveuglément des “winners”.",
  },
  {
    auteur: "Jeffrey Pfeffer, Robert I. Sutton",
    titre: "Hard Facts, Dangerous Half-Truths, and Total Nonsense",
    categorie: "management",
    tags: ["méthode", "exécution", "décision"],
    resume_court: "Evidence-based management : décider et exécuter sur des faits, pas sur des modes.",
    resume_long:
      "Les auteurs défendent un management “evidence-based” : chercher des preuves, tester ce qui marche, et éviter les pratiques à la mode non vérifiées. Pour un entrepreneur, c’est une méthode de travail : instrumenter, observer, expérimenter, puis standardiser ce qui fonctionne.",
  },
  {
    auteur: "W. Chan Kim, Renée Mauborgne",
    titre: "Stratégie Océan Bleu",
    categorie: "management",
    tags: ["stratégie", "marketing", "innovation"],
    resume_court: "Créer de nouveaux espaces de marché plutôt que se battre sur l’existant.",
    resume_long:
      "Le concept d’océan bleu vise à sortir des marchés saturés (océans rouges) en redéfinissant la proposition de valeur. Pour un entrepreneur, c’est utile pour clarifier différenciation, arbitrer “éliminer/réduire/augmenter/créer” et concevoir une offre qui échappe à la comparaison directe.",
  },
  {
    auteur: "Nicolas Gaume",
    titre: "Citizen Game",
    categorie: "management",
    tags: ["innovation", "société", "technologie"],
    resume_court: "Réflexion sur le jeu, les systèmes et l’engagement dans la société numérique.",
    resume_long:
      "Citizen Game explore comment les mécanismes de jeu et les systèmes interactifs influencent l’engagement, l’apprentissage et la participation. Pour un entrepreneur, c’est une source d’idées pour concevoir des produits plus engageants, tout en restant attentif aux incitations et effets de bord.",
  },
  {
    auteur: "Norm Brodsky, Bo Burlingham",
    titre: "The Knack",
    categorie: "management",
    tags: ["stratégie", "exécution", "décision"],
    resume_court: "Leçons de terrain : vente, cash, hiring, et décisions pragmatiques d’entrepreneur.",
    resume_long:
      "Brodsky partage des situations réelles (pricing, cash, croissance, orga) et comment les traiter avec pragmatisme. Pour un entrepreneur, c’est un livre “street-smart” : peu de théorie, beaucoup de décisions concrètes et de repères d’exécution.",
  },
  {
    auteur: "Alain Bloch",
    titre: "La stratégie du propriétaire",
    categorie: "management",
    tags: ["stratégie", "société", "exécution"],
    resume_court: "Résilience des entreprises familiales : gouvernance, long terme et arbitrages de propriétaire.",
    resume_long:
      "Ce livre étudie comment les entreprises familiales traversent les crises grâce à une gouvernance et des arbitrages orientés long terme. Pour un entrepreneur, c’est une perspective utile pour penser capital, contrôle, transmission et robustesse du modèle — au-delà de la croissance à tout prix.",
  },
];

const whyEntrepreneur = (tags, categorie) => {
  const t = new Set(tags);
  const bullets = [];

  if (t.has("effectuation")) {
    bullets.push("Apprendre à avancer sans prédire : partir des moyens disponibles et sécuriser des engagements progressifs.");
  }
  if (t.has("incertitude")) {
    bullets.push("Mieux décider dans un environnement incertain : réduire l'irréversibilité, tester et apprendre vite.");
  }
  if (t.has("théorie des contraintes")) {
    bullets.push("Identifier la contrainte (goulot) et aligner l'organisation sur ce levier pour accélérer sans chaos.");
  }
  if (t.has("méthode")) {
    bullets.push("Construire une culture de test : mesurer, expérimenter, puis standardiser ce qui marche.");
  }
  if (t.has("marketing")) {
    bullets.push("Clarifier proposition de valeur et messages : vendre plus clairement, sans surpromettre.");
  }
  if (t.has("influence")) {
    bullets.push("Mieux convaincre (et se protéger) : comprendre les leviers de persuasion et leurs biais.");
  }

  if (bullets.length < 3) {
    if (String(categorie) === "psychologie") bullets.push("Améliorer focus, décisions et relations : un avantage direct pour l'exécution.");
    else bullets.push("Donner des repères concrets pour exécuter plus vite et décider plus clairement.");
  }

  return bullets.slice(0, 3);
};

const main = async () => {
  const raw = JSON.parse(await readFile(DATA_PATH, "utf8"));
  const livres = Array.isArray(raw?.livres) ? raw.livres : [];

  const existingByTitle = new Map(livres.map((b) => [normalizeLoose(b.titre), b]));

  let added = 0;
  await mkdir(PAGES_DIR, { recursive: true });

  for (const item of list) {
    const key = normalizeLoose(item.titre);
    if (existingByTitle.has(key)) {
      console.log(`[skip] exists: ${item.titre}`);
      continue;
    }

    const slug = slugify(item.titre);
    const bd = `${slug}.html`;
    const image = `../img/books/${slug}.jpg`;

    const { url: url_amazon } = await resolveAmazonUrl({ title: item.titre, author: item.auteur });

    const entry = {
      titre: item.titre,
      auteur: item.auteur,
      image,
      resume_court: item.resume_court,
      tags: item.tags,
      resume_long: item.resume_long,
      url_amazon: url_amazon,
      categorie: item.categorie,
      bd,
      pourquoi_entrepreneur: whyEntrepreneur(item.tags, item.categorie),
    };

    livres.push(entry);
    existingByTitle.set(key, entry);
    added += 1;

    const pagePath = path.join(PAGES_DIR, bd);
    if (!(await fileExists(pagePath))) {
      const html = pageTemplate({ bd, titre: item.titre, resume_court: item.resume_court });
      await writeFile(pagePath, html, "utf8");
      console.log(`+ page pages/${bd}`);
    }
    console.log(`+ book ${item.titre}${url_amazon ? "" : " (amazon url missing)"}`);
  }

  raw.livres = livres;
  await writeFile(DATA_PATH, JSON.stringify(raw, null, 2) + "\n", "utf8");
  console.log(`done: added=${added}`);
};

await main();

