const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function setYear() {
  const yearNode = $("[data-year]");
  if (yearNode) yearNode.textContent = String(new Date().getFullYear());
}

function setupMobileNav() {
  const toggle = $(".navToggle");
  const panel = $("#navPanel");
  if (!toggle || !panel) return;

  const setOpen = (open) => {
    document.body.classList.toggle("navOpen", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.querySelector(".srOnly").textContent = open ? t("menu.close") : t("menu.open");
  };

  toggle.addEventListener("click", () => setOpen(!document.body.classList.contains("navOpen")));
  panel.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.matches("a")) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
}

function setupRevealOnScroll() {
  const revealTargets = $$("[data-reveal]");
  if (revealTargets.length === 0) return;

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("isVisible");
        io.unobserve(entry.target);
      }
    },
    { root: null, threshold: 0.18 }
  );

  for (const el of revealTargets) io.observe(el);
}

function setupPulseSections() {
  const pulseSections = $$("[data-pulse]");
  if (pulseSections.length === 0) return;

  const io = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0];
      if (!visible) return;
      const pulse = visible.target.getAttribute("data-pulse");
      if (pulse) document.body.setAttribute("data-pulse", pulse);
    },
    { root: null, threshold: [0.12, 0.22, 0.35, 0.5] }
  );

  for (const el of pulseSections) io.observe(el);
}

function escapeHtml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function renderMarkdown(text) {
  const raw = String(text || "");
  const fallback = escapeHtml(raw).replace(/\n/g, "<br>");
  if (typeof window === "undefined") return fallback;
  const marked = window.marked;
  const purify = window.DOMPurify;
  if (!marked || !purify) return fallback;
  try {
    const html = marked.parse(raw, { breaks: true, gfm: true });
    return purify.sanitize(html, { USE_PROFILES: { html: true } });
  } catch {
    return fallback;
  }
}

function setBubblePlain(el, text) {
  if (!el) return;
  el.classList.remove("markdown");
  el.classList.add("isPlain");
  el.textContent = String(text || "");
}

function setBubbleMarkdown(el, text) {
  if (!el) return;
  el.classList.remove("isPlain");
  el.classList.add("markdown");
  el.innerHTML = renderMarkdown(text);
}

function similarityScore(query, text) {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (!q) return 0;
  if (t.includes(q)) return 100;
  const qParts = q.split(/\s+/).filter(Boolean);
  let score = 0;
  for (const part of qParts) {
    if (part.length < 3) continue;
    if (t.includes(part)) score += 12;
  }
  return score;
}

const LANG_STORAGE_KEY = "bai.lang";
const SUPPORTED_LANGS = ["fr", "en"];

const TAG_TRANSLATIONS = {
  "biais cognitifs": "cognitive biases",
  "biais cognitif": "cognitive bias",
  "décision": "decision-making",
  "effectuation": "effectuation",
  "exécution": "execution",
  "gestion de projet": "project management",
  "incertitude": "uncertainty",
  "influence": "influence",
  "innovation": "innovation",
  "intuition": "intuition",
  "langage": "language",
  "marketing": "marketing",
  "méthode": "method",
  "psychologie": "psychology",
  "société": "society",
  "stratégie": "strategy",
  "synchronicité": "synchronicity",
  "sérendipité": "serendipity",
  "technologie": "technology",
  "théorie des contraintes": "theory of constraints",
  "éthique": "ethics",
  "acquisition": "acquisition",
  "actionnariat": "equity ownership",
  "capital": "equity",
  "chaos": "chaos",
  "conflit d'intérêt": "conflict of interest",
  "créativité": "creativity",
  "délégation": "delegation",
  "essentiels": "essentials",
  "financement": "financing",
  "inspiration": "inspiration",
  "management": "management",
  "neurosciences": "neuroscience",
  "négociation": "negotiation",
  "productivité": "productivity",
  "prospection": "prospecting",
  "résilience": "resilience",
  "vente": "sales",
  "équipe": "team",
};

const CATEGORY_TRANSLATIONS = {
  hasard: "uncertainty",
  humanite: "humanity",
  management: "management",
  philosophie: "philosophy",
  psychologie: "psychology",
  semiotique: "semiotics",
  sociologie: "sociology",
};

const I18N = {
  fr: {
    langLabel: "Langue",
    skip: "Aller au contenu",
    menu: {
      open: "Ouvrir le menu",
      close: "Fermer le menu",
    },
    nav: {
      home: "Accueil",
      assistant: "Assistant IA",
      conseils: "Conseils",
      bibliotheque: "Bibliothèque",
      apropos: "À propos",
    },
    footer: {
      legal: "Mentions légales",
    },
    common: {
      close: "Fermer",
    },
    home: {
      heroTitle: "Les meilleures pratiques<br />pour Entrepreneurs",
      heroSubtitle: "Des réponses concrètes, des conseils structurés, et une bibliothèque utile.",
      heroLead:
        "The Entrepreneur Whisperer rassemble une base de connaissance pour entrepreneurs, un assistant IA pour retrouver la bonne réponse, et des conseils par thèmes (avec recherche) — le tout dans un format qui se consomme vite.",
      mediaLabel: "Vidéo / Podcast",
      mediaPlaceholder: "Ajouter un épisode (placeholder)",
      mediaHint: "Astuce : vous pouvez remplacer ce bloc par un embed YouTube/Spotify.",
      sectionTitle: "Une boîte à idées pour les Entrepreneurs",
      sectionLead:
        "Trouver une réponse, appliquer une bonne pratique, et passer à l’étape suivante. Chaque contenu est pensé pour être recherché, partagé, et retenu.",
      cardAssistantTitle: "Assistant IA",
      cardAssistantDesc: "Le coin interactif : réponses formulées à partir de la base de connaissance.",
      cardConseilsTitle: "Conseils",
      cardConseilsDesc: "Le coin podcast : conseils par thèmes, recherche, + podcast audio et mini-BD.",
      cardBibliothequeTitle: "Bibliothèque",
      cardBibliothequeDesc: "Le coin lecture : recueil de livres recommandés pour entrepreneurs.",
    },
    assistant: {
      pill: "Le coin interactif",
      title: "Assistant IA",
      lead: "Réponses formulées à partir de la base de connaissance, via l’API Responses d’OpenAI.",
      inputLabel: "Votre question",
      inputPlaceholder: "Ex: Comment prioriser mon roadmap produit ?",
      submit: "Envoyer",
      welcomeTitle: "Bienvenue",
      welcomeText: "Pose une question, et le Whisperer te répondra à partir de sa base de connaissance.",
      assistantTitle: "Assistant",
      userTitle: "Vous",
      thinking: "Je réfléchis…",
      examplesTitle: "Exemples",
      examplesTrigger: ["exemples"],
      examples: [
        "À quels investissements donner la priorité en période de crise ?",
        "Comment structurer la rémunération des commerciaux ?",
        "Comment optimiser une tarification B2B ?",
        "Qu’est-ce que l’effectuation et comment l’appliquer ?",
        "Comment appliquer la théorie des contraintes (TOC) au quotidien ?",
        "Quels leviers pour améliorer mon organisation (Lean / Deming) ?",
      ],
      error: "Désolé, je n’arrive pas à répondre.",
      noAnswer: "Je n’ai pas de réponse pour le moment.",
    },
    conseils: {
      pill: "Le coin podcast",
      title: "Conseils",
      lead: "Recherche par thèmes. Chaque entrée se lit, s’écoute (voix), et se retient (mini BD).",
      searchLabel: "Rechercher",
      searchPlaceholder: "Rechercher un conseil (ex: pricing, focus…)",
      filtersLabel: "Filtres",
      filterAll: "Tous",
      filterProduct: "Produit",
      filterSales: "Vente",
      filterExecution: "Exécution",
      filterTeam: "Équipe",
      modalLabel: "Détail du conseil",
      audioLabel: "Podcast audio",
      audioTitle: "Podcast audio (voix)",
      audioHint: "Lecture via synthèse vocale du navigateur.",
      audioPlay: "Lire",
      audioStop: "Stop",
      comicLabel: "Bande dessinée",
      comicTitle: "Mini BD",
      count: {
        one: "{count} conseil",
        other: "{count} conseils",
      },
      unavailableTitle: "Conseils indisponibles",
      unavailableBody: "Impossible de charger <code>data/conseils.json</code>.",
      imageAlt: "Visuel pour {title}",
      audioUnsupported: "Votre navigateur ne supporte pas l’élément audio.",
    },
    bibliotheque: {
      pill: "Le coin lecture",
      title: "Bibliothèque",
      lead: "Un recueil de livres recommandés pour entrepreneurs, triables par intention.",
      searchLabel: "Rechercher un livre",
      searchPlaceholder: "Rechercher un livre (ex: pricing, produit…)",
      filtersLabel: "Tags",
      listLabel: "Liste des livres",
      count: {
        one: "{count} livre",
        other: "{count} livres",
      },
      tagAll: "tous",
      unavailableTitle: "Bibliothèque indisponible",
      unavailableBody: "Impossible de charger <code>../data/bibliotheque.json</code>.",
      unavailableHint: "Astuce : vérifiez que vous servez le dossier du projet (pas seulement <code>pages/</code>).",
    },
    bookDetail: {
      summaryTitle: "Résumé",
      whyTitle: "Pourquoi c'est utile pour un entrepreneur",
      amazon: "Voir sur Amazon",
      wikipedia: "Wikipedia",
      sourceNote: "Source complémentaire : {source}.",
      coverAlt: "Couverture du livre {title}",
      back: "← Retour à la bibliothèque",
      missingTitle: "Page introuvable",
      missingBody: "Cette page ne sait pas quel livre afficher.",
      missingHint: "Astuce : ajoutez <code>data-book</code> sur <code>&lt;body&gt;</code>.",
      notFoundTitle: "Livre introuvable",
      notFoundBody: "Impossible de charger ce livre depuis <code>../data/bibliotheque.json</code>.",
      notFoundDetail: "Détail : {detail}",
    },
    apropos: {
      pill: "Qui est derrière ?",
      title: "À propos",
      lead: "Présentation de l’auteur, de la démarche, et de Melcion.",
      tdvRole: "Entrepreneur • produit • exécution",
      tdvText:
        "The Entrepreneur Whisperer est un espace de synthèse : extraire les meilleures pratiques, les structurer, et les rendre faciles à retrouver.",
      melcionRole: "Co-pilote • structure • clarté",
      melcionText: "Melcion aide à transformer l’expérience en contenu opérationnel : checklists, templates, et réponses nettes.",
    },
    mentions: {
      pill: "Informations",
      title: "Mentions légales",
      lead: "À compléter avec vos informations (éditeur, hébergeur, contact, etc.).",
      publisherTitle: "Éditeur du site",
      publisherName: "Nom / société : …",
      publisherAddress: "Adresse : …",
      publisherEmail: "Email : …",
      hostingTitle: "Hébergement",
      hostingName: "Hébergeur : …",
      hostingAddress: "Adresse : …",
      ipTitle: "Propriété intellectuelle",
      ipBody: "Contenus, marque, et éléments graphiques : …",
      cookiesTitle: "Cookies & mesure d’audience",
      cookiesBody: "Outils utilisés, finalités, durée : …",
    },
    meta: {
      home: {
        title: "The Entrepreneur Whisperer — Les meilleures pratiques pour Entrepreneurs",
        description:
          "The Entrepreneur Whisperer : Les meilleures pratiques pour Entrepreneurs. Assistant IA, conseils actionnables, bibliothèque de livres recommandés.",
      },
      assistant: {
        title: "Assistant IA — The Entrepreneur Whisperer",
        description: "Assistant IA : Le coin interactif, formulé à partir de la base de connaissance.",
      },
      conseils: {
        title: "Conseils — The Entrepreneur Whisperer",
        description:
          "Le coin podcast : conseils par thèmes avec recherche. Chaque entrée a un format audio et une mini bande dessinée.",
      },
      bibliotheque: {
        title: "Bibliothèque — The Entrepreneur Whisperer",
        description: "Recueil de livres recommandés pour les entrepreneurs.",
      },
      apropos: {
        title: "À propos — The Entrepreneur Whisperer",
        description: "Présentation de l’auteur et de Melcion.",
      },
      mentions: {
        title: "Mentions légales — The Entrepreneur Whisperer",
        description: "Mentions légales du site The Entrepreneur Whisperer.",
      },
    },
    playPlaceholder:
      "Placeholder : remplacez ce bloc par un embed (YouTube/Spotify) ou un lecteur audio/vidéo.",
  },
  en: {
    langLabel: "Language",
    skip: "Skip to content",
    menu: {
      open: "Open menu",
      close: "Close menu",
    },
    nav: {
      home: "Home",
      assistant: "AI Assistant",
      conseils: "Advice",
      bibliotheque: "Library",
      apropos: "About",
    },
    footer: {
      legal: "Legal notice",
    },
    common: {
      close: "Close",
    },
    home: {
      heroTitle: "Best practices<br />for entrepreneurs",
      heroSubtitle: "Concrete answers, structured advice, and a useful library.",
      heroLead:
        "The Entrepreneur Whisperer brings together a knowledge base for entrepreneurs, an AI assistant to find the right answer, and theme-based advice (with search) — all in a fast, digestible format.",
      mediaLabel: "Video / Podcast",
      mediaPlaceholder: "Add an episode (placeholder)",
      mediaHint: "Tip: you can replace this block with a YouTube/Spotify embed.",
      sectionTitle: "An idea box for entrepreneurs",
      sectionLead:
        "Find an answer, apply a good practice, and move to the next step. Every piece of content is designed to be searchable, shareable, and memorable.",
      cardAssistantTitle: "AI Assistant",
      cardAssistantDesc: "Interactive corner: answers formulated from the knowledge base.",
      cardConseilsTitle: "Advice",
      cardConseilsDesc: "Podcast corner: theme-based advice, search, + audio and mini comic.",
      cardBibliothequeTitle: "Library",
      cardBibliothequeDesc: "Reading corner: a collection of recommended books for entrepreneurs.",
    },
    assistant: {
      pill: "Interactive corner",
      title: "AI Assistant",
      lead: "Answers generated from the knowledge base, via OpenAI's Responses API.",
      inputLabel: "Your question",
      inputPlaceholder: "e.g., How should I prioritize my product roadmap?",
      submit: "Send",
      welcomeTitle: "Welcome",
      welcomeText: "Ask a question and the Whisperer will answer from its knowledge base.",
      assistantTitle: "Assistant",
      userTitle: "You",
      thinking: "Thinking…",
      examplesTitle: "Examples",
      examplesTrigger: ["examples"],
      examples: [
        "Which investments should I prioritize during a crisis?",
        "How should I structure sales compensation?",
        "How do I optimize B2B pricing?",
        "What is effectuation and how do I apply it?",
        "How do I apply the Theory of Constraints (TOC) day to day?",
        "Which levers improve my organization (Lean / Deming)?",
      ],
      error: "Sorry, I can’t answer right now.",
      noAnswer: "I don’t have an answer for the moment.",
    },
    conseils: {
      pill: "Podcast corner",
      title: "Advice",
      lead: "Search by theme. Each entry can be read, listened to (voice), and remembered (mini comic).",
      searchLabel: "Search",
      searchPlaceholder: "Search a tip (e.g., pricing, focus…)",
      filtersLabel: "Filters",
      filterAll: "All",
      filterProduct: "Product",
      filterSales: "Sales",
      filterExecution: "Execution",
      filterTeam: "Team",
      modalLabel: "Advice details",
      audioLabel: "Audio podcast",
      audioTitle: "Audio podcast (voice)",
      audioHint: "Playback via your browser’s text-to-speech.",
      audioPlay: "Play",
      audioStop: "Stop",
      comicLabel: "Comic strip",
      comicTitle: "Mini comic",
      count: {
        one: "{count} tip",
        other: "{count} tips",
      },
      unavailableTitle: "Advice unavailable",
      unavailableBody: "Unable to load <code>data/conseils.json</code>.",
      imageAlt: "Visual for {title}",
      audioUnsupported: "Your browser does not support the audio element.",
    },
    bibliotheque: {
      pill: "Reading corner",
      title: "Library",
      lead: "A collection of recommended books for entrepreneurs, filterable by intent.",
      searchLabel: "Search a book",
      searchPlaceholder: "Search a book (e.g., pricing, strategy…)",
      filtersLabel: "Tags",
      listLabel: "Book list",
      count: {
        one: "{count} book",
        other: "{count} books",
      },
      tagAll: "all",
      unavailableTitle: "Library unavailable",
      unavailableBody: "Unable to load <code>../data/bibliotheque.json</code>.",
      unavailableHint: "Tip: make sure you're serving the project folder (not just <code>pages/</code>).",
    },
    bookDetail: {
      summaryTitle: "Summary",
      whyTitle: "Why it’s useful for an entrepreneur",
      amazon: "View on Amazon",
      wikipedia: "Wikipedia",
      sourceNote: "Additional source: {source}.",
      coverAlt: "Book cover for {title}",
      back: "← Back to library",
      missingTitle: "Page not found",
      missingBody: "This page doesn’t know which book to display.",
      missingHint: "Tip: add <code>data-book</code> on <code>&lt;body&gt;</code>.",
      notFoundTitle: "Book not found",
      notFoundBody: "Unable to load this book from <code>../data/bibliotheque.json</code>.",
      notFoundDetail: "Detail: {detail}",
    },
    apropos: {
      pill: "Who’s behind it?",
      title: "About",
      lead: "Overview of the author, the approach, and Melcion.",
      tdvRole: "Entrepreneur • product • execution",
      tdvText:
        "The Entrepreneur Whisperer is a synthesis space: extract best practices, structure them, and make them easy to retrieve.",
      melcionRole: "Co-pilot • structure • clarity",
      melcionText: "Melcion helps turn experience into operational content: checklists, templates, and clear answers.",
    },
    mentions: {
      pill: "Information",
      title: "Legal notice",
      lead: "Fill in with your information (publisher, hosting, contact, etc.).",
      publisherTitle: "Site publisher",
      publisherName: "Name / company: …",
      publisherAddress: "Address: …",
      publisherEmail: "Email: …",
      hostingTitle: "Hosting",
      hostingName: "Host: …",
      hostingAddress: "Address: …",
      ipTitle: "Intellectual property",
      ipBody: "Content, brand, and visual elements: …",
      cookiesTitle: "Cookies & analytics",
      cookiesBody: "Tools used, purposes, retention: …",
    },
    meta: {
      home: {
        title: "The Entrepreneur Whisperer — Best practices for entrepreneurs",
        description:
          "The Entrepreneur Whisperer: best practices for entrepreneurs. AI assistant, actionable advice, curated book library.",
      },
      assistant: {
        title: "AI Assistant — The Entrepreneur Whisperer",
        description: "AI Assistant: the interactive corner powered by the knowledge base.",
      },
      conseils: {
        title: "Advice — The Entrepreneur Whisperer",
        description:
          "Podcast corner: theme-based advice with search. Each entry includes audio and a mini comic strip.",
      },
      bibliotheque: {
        title: "Library — The Entrepreneur Whisperer",
        description: "Collection of recommended books for entrepreneurs.",
      },
      apropos: {
        title: "About — The Entrepreneur Whisperer",
        description: "Overview of the author and Melcion.",
      },
      mentions: {
        title: "Legal notice — The Entrepreneur Whisperer",
        description: "Legal notice for The Entrepreneur Whisperer.",
      },
    },
    playPlaceholder: "Placeholder: replace this block with a YouTube/Spotify embed or an audio/video player.",
  },
};

let currentLang = "fr";

const normalizeLang = (value) => {
  const v = String(value || "").toLowerCase();
  if (!SUPPORTED_LANGS.includes(v)) return "";
  return v;
};

const resolveLang = () => {
  const params = new URLSearchParams(window.location.search);
  const urlLang = normalizeLang(params.get("lang"));
  if (urlLang) return urlLang;
  const stored = normalizeLang(localStorage.getItem(LANG_STORAGE_KEY));
  if (stored) return stored;
  const browser = String(navigator.language || "").toLowerCase();
  return browser.startsWith("en") ? "en" : "fr";
};

const getI18nValue = (lang, key) => {
  if (!key) return "";
  const root = I18N[lang] || I18N.fr;
  return key.split(".").reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), root);
};

const formatText = (value, vars) => {
  if (typeof value !== "string") return value;
  return value.replace(/\{(\w+)\}/g, (_, key) => String(vars?.[key] ?? ""));
};

const t = (key, vars, fallback = "") => {
  const raw = getI18nValue(currentLang, key);
  if (raw === undefined || raw === null || raw === "") return formatText(fallback, vars);
  return formatText(raw, vars);
};

const translateTag = (tag, lang = currentLang) => {
  if (lang !== "en") return String(tag || "");
  const key = String(tag || "").trim().toLowerCase();
  return TAG_TRANSLATIONS[key] || String(tag || "");
};

const translateCategory = (category, lang = currentLang) => {
  if (lang !== "en") return String(category || "");
  const key = String(category || "").trim().toLowerCase();
  return CATEGORY_TRANSLATIONS[key] || String(category || "");
};

const normalizeFilterValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const appendLangParam = (href, lang = currentLang) => {
  if (!href || typeof href !== "string") return href;
  if (href.startsWith("#") || /^(https?:|mailto:|tel:)/i.test(href)) return href;
  if (!href.includes(".html")) return href;
  const [pathWithQuery, hash] = href.split("#");
  const [path, queryString] = pathWithQuery.split("?");
  const params = new URLSearchParams(queryString || "");
  params.set("lang", lang);
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
};

const updateInternalLinks = (lang = currentLang) => {
  $$("a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    const next = appendLangParam(href, lang);
    if (next && next !== href) link.setAttribute("href", next);
  });
};

const applyNavI18n = () => {
  const skip = $(".skipLink");
  if (skip) skip.textContent = t("skip");

  $$(".navLink").forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (href.includes("index.html")) link.textContent = t("nav.home");
    else if (href.includes("assistant-ia.html")) link.textContent = t("nav.assistant");
    else if (href.includes("conseils.html")) link.textContent = t("nav.conseils");
    else if (href.includes("bibliotheque.html")) link.textContent = t("nav.bibliotheque");
    else if (href.includes("a-propos.html")) link.textContent = t("nav.apropos");
  });

  const toggleLabel = $(".navToggle .srOnly");
  if (toggleLabel) toggleLabel.textContent = t("menu.open");

  $$(".footerLegal").forEach((link) => {
    link.textContent = t("footer.legal");
  });
};

const applyI18n = () => {
  $$("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    const value = getI18nValue(currentLang, key);
    if (!value) return;
    if (el.dataset.i18nHtml === "true") {
      el.innerHTML = value;
    } else {
      el.textContent = value;
    }
  });

  $$("[data-i18n-attr]").forEach((el) => {
    const attr = el.dataset.i18nAttr;
    const key = el.dataset.i18nKey || el.dataset.i18n;
    const value = getI18nValue(currentLang, key);
    if (!attr || !value) return;
    el.setAttribute(attr, value);
  });
};

const applyMeta = () => {
  const pageKey = document.body?.dataset?.page;
  if (!pageKey) return;
  const meta = I18N[currentLang]?.meta?.[pageKey];
  if (meta?.title) document.title = meta.title;
  const desc = $("meta[name='description']");
  if (desc && meta?.description) desc.setAttribute("content", meta.description);
};

const formatCount = (count, key) => {
  const template = t(`${key}.${count === 1 ? "one" : "other"}`, { count });
  return template || String(count);
};

const initLanguage = () => {
  const lang = resolveLang();
  currentLang = lang || "fr";
  document.documentElement.lang = currentLang;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, currentLang);
  } catch {
    // ignore storage failures
  }
  return currentLang;
};

const setupLangToggle = () => {
  const panel = $(".navPanel");
  if (!panel || panel.querySelector(".langSwitcher")) return;

  const wrapper = document.createElement("div");
  wrapper.className = "langSwitcher";
  wrapper.setAttribute("role", "group");
  wrapper.setAttribute("aria-label", t("langLabel"));

  const makeButton = (lang, label) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "langOption";
    btn.dataset.lang = lang;
    btn.textContent = label;
    btn.setAttribute("aria-pressed", lang === currentLang ? "true" : "false");
    if (lang === currentLang) btn.classList.add("isActive");
    return btn;
  };

  wrapper.appendChild(makeButton("fr", "FR"));
  wrapper.appendChild(document.createTextNode("/"));
  wrapper.appendChild(makeButton("en", "EN"));

  wrapper.addEventListener("click", (event) => {
    const btn = event.target instanceof HTMLElement ? event.target.closest("button[data-lang]") : null;
    if (!btn) return;
    const nextLang = normalizeLang(btn.dataset.lang);
    if (!nextLang || nextLang === currentLang) return;
    try {
      localStorage.setItem(LANG_STORAGE_KEY, nextLang);
    } catch {
      // ignore
    }
    const url = new URL(window.location.href);
    url.searchParams.set("lang", nextLang);
    window.location.href = url.toString();
  });

  panel.appendChild(wrapper);
};

function setupAssistantPage() {
  if (document.body.dataset.page !== "assistant") return;

  const stream = $("#chatStream");
  const form = $("#chatForm");
  const input = $("#chatInput");
  if (!stream || !form || !input) return;

  const STORAGE_KEY = "bai.assistant.conversation.v1";
  const IDLE_RESET_MS = 45 * 60 * 1000;
  const MAX_STORED_MESSAGES = 40;

  const exampleQuestions = getI18nValue(currentLang, "assistant.examples") || [];
  const examplesTrigger = getI18nValue(currentLang, "assistant.examplesTrigger") || [];

  const conversation = [];

  const loadConversation = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const updatedAt = Number(parsed?.updatedAt || 0);
      if (!updatedAt || Date.now() - updatedAt > IDLE_RESET_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return [];
      }
      const items = Array.isArray(parsed?.items) ? parsed.items : [];
      return items
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-MAX_STORED_MESSAGES);
    } catch {
      return [];
    }
  };

  const saveConversation = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          updatedAt: Date.now(),
          items: conversation.slice(-MAX_STORED_MESSAGES),
        })
      );
    } catch {
      // ignore (storage disabled/quota)
    }
  };

  const resetConversation = () => {
    conversation.splice(0, conversation.length);
    stream.innerHTML = "";
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    pushBubble({
      who: "bot",
      title: t("assistant.welcomeTitle"),
      text: t("assistant.welcomeText"),
      format: "markdown",
    });
  };

  const pushBubble = ({ who, title, text, format = "plain" }) => {
    const el = document.createElement("div");
    el.className = `bubble ${who}`;

    if (title) {
      const titleEl = document.createElement("p");
      titleEl.className = "bubbleTitle";
      titleEl.textContent = title;
      el.appendChild(titleEl);
    }

    const textEl = document.createElement("div");
    textEl.className = "bubbleText";
    if (format === "markdown") {
      setBubbleMarkdown(textEl, text);
    } else {
      setBubblePlain(textEl, text);
    }
    el.appendChild(textEl);

    stream.appendChild(el);
    stream.scrollTop = stream.scrollHeight;
    return el;
  };

  const restored = loadConversation();
  if (restored.length > 0) {
    conversation.push(...restored);
    for (const item of restored) {
      const isBot = item.role === "assistant";
      pushBubble({
        who: isBot ? "bot" : "me",
        title: isBot ? t("assistant.assistantTitle") : t("assistant.userTitle"),
        text: item.content,
        format: isBot ? "markdown" : "plain",
      });
    }
  } else {
    pushBubble({
      who: "bot",
      title: t("assistant.welcomeTitle"),
      text: t("assistant.welcomeText"),
      format: "markdown",
    });
  }

  // Auto reset after 45 minutes without usage (best-effort).
  const idleCheck = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const updatedAt = Number(parsed?.updatedAt || 0);
      if (updatedAt && Date.now() - updatedAt > IDLE_RESET_MS) resetConversation();
    } catch {
      // ignore
    }
  };
  const idleTimer = window.setInterval(idleCheck, 60 * 1000);
  window.addEventListener("beforeunload", () => window.clearInterval(idleTimer), { once: true });

  const showExamples = () => {
    pushBubble({
      who: "bot",
      title: t("assistant.examplesTitle"),
      text: exampleQuestions
        .slice(0, 8)
        .map((q) => `• ${q}`)
        .join("\n"),
      format: "plain",
    });
  };

  form.addEventListener("submit", (event) => {
    (async () => {
      event.preventDefault();
      idleCheck();
      const q = String(input.value || "").trim();
      if (!q) return;
      input.value = "";

      const historyForServer = conversation.slice();
      conversation.push({ role: "user", content: q });
      saveConversation();
      pushBubble({ who: "me", title: t("assistant.userTitle"), text: q, format: "plain" });

      if (examplesTrigger.includes(q.toLowerCase())) {
        showExamples();
        return;
      }

      const submitBtn = form.querySelector("button[type='submit']");
      if (submitBtn) submitBtn.disabled = true;
      input.disabled = true;

      const placeholder = pushBubble({
        who: "bot",
        title: t("assistant.assistantTitle"),
        text: t("assistant.thinking"),
        format: "plain",
      });

      try {
        const resp = await fetch("../api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: q, history: historyForServer, stream: true }),
        });

        const contentType = String(resp.headers.get("content-type") || "");
        if (!resp.ok && !contentType.includes("text/event-stream")) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data?.error || `Erreur API (${resp.status})`);
        }

        if (contentType.includes("text/event-stream")) {
          const decoder = new TextDecoder();
          const reader = resp.body?.getReader();
          if (!reader) throw new Error("Streaming non supporté par ce navigateur.");

          let buffer = "";
          let currentEvent = "message";
          let answer = "";
          let sources = [];
          let meta = null;

          const flushIfDone = () => {
            const sourcesText = "";
            const debug = meta && meta.debug ? meta.debug : null;
            const debugText =
              debug
                ? `\n\nDiagnostic (tech) :\n• status: ${String(debug.status || "")}\n• error: ${String(
                    debug.error || ""
                  )}\n• incomplete: ${String(debug.incomplete_reason || "")}`
                : "";
            const bubble = placeholder.querySelector(".bubbleText");
            setBubbleMarkdown(bubble, `${answer || "Je n’ai pas de réponse pour le moment."}${sourcesText}${debugText}`);
          };

          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            while (buffer.includes("\n")) {
              const idx = buffer.indexOf("\n");
              const line = buffer.slice(0, idx).replace(/\r$/, "");
              buffer = buffer.slice(idx + 1);

              if (!line) {
                currentEvent = "message";
                continue;
              }
              if (line.startsWith("event:")) {
                currentEvent = line.slice(6).trim();
                continue;
              }
              if (line.startsWith("data:")) {
                const dataStr = line.slice(5).trimStart();
                if (currentEvent === "delta") {
                  try {
                    const parsed = JSON.parse(dataStr);
                    const delta = String(parsed?.delta ?? "");
                    if (delta) answer += delta;
                  } catch {
                    answer += dataStr;
                  }
                  setBubblePlain(placeholder.querySelector(".bubbleText"), answer);
                  continue;
                }
                if (currentEvent === "meta") {
                  try {
                    meta = JSON.parse(dataStr);
                    sources = Array.isArray(meta?.sources) ? meta.sources : [];
                  } catch {
                    meta = null;
                  }
                  continue;
                }
                if (currentEvent === "error") {
                  try {
                    const parsed = JSON.parse(dataStr);
                    throw new Error(String(parsed?.error || "Erreur streaming"));
                  } catch {
                    throw new Error(dataStr || "Erreur streaming");
                  }
                }
                if (currentEvent === "done") {
                  flushIfDone();
                }
              }
            }
          }

          flushIfDone();
          conversation.push({ role: "assistant", content: answer });
          saveConversation();
        } else {
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) throw new Error(data?.error || `Erreur API (${resp.status})`);

          const answer = String(data?.answer || "").trim() || t("assistant.noAnswer");
          const sources = Array.isArray(data?.sources) ? data.sources : [];
          const debug = data?.debug && typeof data.debug === "object" ? data.debug : null;
          const sourcesText = "";
          const debugText =
            debug
              ? `\n\nDiagnostic (tech) :\n• status: ${String(debug.status || "")}\n• error: ${String(
                  debug.error || ""
                )}\n• incomplete: ${String(debug.incomplete_reason || "")}`
              : "";

          setBubbleMarkdown(placeholder.querySelector(".bubbleText"), `${answer}${sourcesText}${debugText}`);
          conversation.push({ role: "assistant", content: answer });
          saveConversation();
        }
      } catch (err) {
        setBubblePlain(
          placeholder.querySelector(".bubbleText"),
          `${t("assistant.error")}\n${err?.message || ""}`.trim()
        );
      } finally {
        if (submitBtn) submitBtn.disabled = false;
        input.disabled = false;
        input.focus();
      }
    })();
  });
}

function setupConseilsPage() {
  if (document.body.dataset.page !== "conseils") return;

  const grid = $("#conseilsGrid");
  const search = $("#search");
  const filtersContainer = $(".filters");
  if (!grid || !search || !filtersContainer) return;

  const lang = currentLang;
  let activeFilter = "all";
  let conseils = [];

  // Create and insert the count element
  const count = document.createElement("p");
  count.className = "muted tiny";
  count.id = "conseilsCount";
  count.setAttribute("aria-live", "polite");
  search.parentElement.insertBefore(count, filtersContainer.nextSibling);

  const searchConseil = (conseil, words) => {
    const translatedTags = lang === "en" ? (conseil.tags || []).map((tag) => translateTag(tag, lang)) : [];
    const fields = {
      primary: [conseil.titre, ...(conseil.tags || []), ...translatedTags],
      secondary: [conseil.resume_court, conseil.resume_long, conseil.descriptif_long],
    };

    let score = 0;
    
    // All words must be present ("AND" logic)
    for (const word of words) {
        let wordFound = false;
        let wordScore = 0;

        for (const field of fields.primary) {
            if (String(field).toLowerCase().includes(word)) {
                wordScore = Math.max(wordScore, 3);
                wordFound = true;
            }
        }
        for (const field of fields.secondary) {
            if (String(field).toLowerCase().includes(word)) {
                wordScore = Math.max(wordScore, 1);
                wordFound = true;
            }
        }
        if (!wordFound) return { matches: false, score: 0 };
        score += wordScore;
    }

    return { matches: true, score };
  };

  const render = () => {
    const q = String(search.value || "").trim().toLowerCase();
    const words = q ? q.split(/\s+/).filter(Boolean) : [];

    const filtered = conseils
      .map((c) => {
        const uniqueTags = [...new Set((c.tags || []).map((tag) => normalizeFilterValue(tag)))];
        const matchesFilter =
          normalizeFilterValue(activeFilter) === "all"
            ? true
            : uniqueTags.includes(normalizeFilterValue(activeFilter));
        if (!matchesFilter) return null;
        
        if (words.length === 0) {
          return { conseil: c, score: 0 };
        }

        const result = searchConseil(c, words);
        return result.matches ? { conseil: c, score: result.score } : null;
      })
      .filter(Boolean);

    filtered.sort((a, b) => b.score - a.score);
    
    count.textContent = formatCount(filtered.length, "conseils.count");

    grid.innerHTML = filtered
      .map(({ conseil: c }) => {
        const tags = (c.tags || [])
          .slice(0, 3)
          .map((t) => `<span class="tag">${escapeHtml(lang === "en" ? translateTag(t, lang) : String(t))}</span>`)
          .join("");

        const imageSrc = c.nom_image ? `../${escapeHtml(c.nom_image)}` : "";
        const audioSrc = c.nom_fichier_audio ? `../${escapeHtml(c.nom_fichier_audio)}` : "";
        const imageAlt = t("conseils.imageAlt", { title: c.titre || "" });

        return `
          <article class="card" tabindex="0" role="button" style="display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <h3>${escapeHtml(c.titre)}</h3>
              ${
                imageSrc
                  ? `<img src="${imageSrc}" alt="${escapeHtml(imageAlt)}" width="300" style="margin-top: 8px; margin-bottom: 16px; border-radius: 8px; max-width: 100%;">`
                  : ""
              }
              <p>${escapeHtml(c.resume_court)}</p>
            </div>
            <div>
              ${
                audioSrc
                  ? `<audio controls preload="none" style="width: 100%; margin-top: 16px;"><source src="${audioSrc}" type="audio/mpeg">${escapeHtml(
                      t("conseils.audioUnsupported")
                    )}</audio>`
                  : ""
              }
              <div class="tagRow" style="margin-top: 8px;">${tags}</div>
            </div>
          </article>
        `;
      })
      .join("");
  };
  
  const updateFilters = () => {
    const allTags = [...new Set(conseils.flatMap(c => c.tags))];
    allTags.sort();
    const currentActive = activeFilter;
    
    let filterHtml = `<button class="chip ${currentActive === "all" ? "isActive" : ""}" type="button" data-filter="all">Tous</button>`;
    
    // Use the hardcoded filters from the HTML first
    const existingFilters = $$("button[data-filter]", filtersContainer);
    const existingFilterKeys = existingFilters.map(ef => ef.dataset.filter).filter(f => f !== 'all');
    
    for(const key of existingFilterKeys) {
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        filterHtml += `<button class="chip ${currentActive === key ? "isActive" : ""}" type="button" data-filter="${escapeHtml(key)}">${escapeHtml(label)}</button>`;
    }
    
    filtersContainer.innerHTML = filterHtml;
  }

  filtersContainer.addEventListener("click", (event) => {
    const btn = event.target instanceof HTMLElement ? event.target.closest("[data-filter]") : null;
    if (!btn) return;
    activeFilter = btn.getAttribute("data-filter") || "all";
    $$("button", filtersContainer).forEach(b => b.classList.remove("isActive"));
    btn.classList.add("isActive");
    render();
  });

  search.addEventListener("input", render);

  (async () => {
    try {
      const resp = await fetch("../data/conseils.json", { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      let items = Array.isArray(data?.conseils) ? data.conseils : [];

      if (lang === "en") {
        try {
          const trResp = await fetch("../data/conseils.en.json", { cache: "no-store" });
          if (trResp.ok) {
            const trData = await trResp.json();
            const translations = Array.isArray(trData?.conseils) ? trData.conseils : [];
            const byId = new Map(translations.map((c) => [String(c?.id || ""), c]));
            items = items.map((c) => {
              const id = String(c?.id || "");
              if (!id || !byId.has(id)) return c;
              return { ...c, ...byId.get(id) };
            });
          }
        } catch (err) {
          console.warn("Unable to load English conseils translation.", err);
        }
      }

      conseils = items;
    } catch (e) {
      console.error(e);
      conseils = [];
    }
    // Don't auto-update filters, use the ones from the HTML
    // updateFilters(); 
    render();

    if (conseils.length === 0) {
      grid.innerHTML = `
        <article class="infoCard">
          <h3>${t("conseils.unavailableTitle")}</h3>
          <p>${t("conseils.unavailableBody")}</p>
        </article>
      `;
    }
  })();
}

function setupBibliothequePage() {
  if (document.body.dataset.page !== "bibliotheque") return;

  const grid = $("#bookGrid");
  const search = $("#bookSearch");
  const tagFilters = $("#tagFilters");
  const count = $("#bookCount");
  if (!grid || !search) return;

  const lang = currentLang;
  let activeTag = "all";
  let books = [];

  const normalizeCategory = (category) =>
    String(category || "")
      .trim()
      .toLowerCase()
      .replaceAll(" ", "-");

  const normalizeTag = (tag) =>
    String(tag || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  const uniqueNormalizedTags = (tags) => {
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

  const renderTagFilters = () => {
    if (!tagFilters) return;

    const counts = new Map();
    for (const b of books) {
      const tags = uniqueNormalizedTags(b.tags);
      for (const t of tags) counts.set(t, (counts.get(t) || 0) + 1);
    }

    const tagsSorted = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag);

    tagFilters.innerHTML = [
      `<button class="chip ${activeTag === "all" ? "isActive" : ""}" type="button" data-tag="all">${escapeHtml(
        t("bibliotheque.tagAll")
      )}</button>`,
      ...tagsSorted.map((t) => {
        const isActive = activeTag === t;
        const label = lang === "en" ? translateTag(t, lang) : t;
        return `<button class="chip ${isActive ? "isActive" : ""}" type="button" data-tag="${escapeHtml(t)}">${escapeHtml(
          label
        )}</button>`;
      }),
    ].join("");
  };

  const matchesWord = (text, word) => {
    const textLower = text.toLowerCase();
    const wordLower = word.toLowerCase();

    // Match exact
    if (textLower === wordLower) return "exact";

    // Match au début du texte
    if (textLower.startsWith(wordLower)) return "start";

    // Match au début d'un mot (après espace, tiret, apostrophe)
    const regex = new RegExp(`(^|\\s|-|')${wordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    if (regex.test(text)) return "word-start";

    return null;
  };

  const searchBook = (book, words) => {
    const translatedTags = lang === "en" ? (book.tags || []).map((tag) => translateTag(tag, lang)) : [];
    const translatedCategory = lang === "en" ? translateCategory(book.categorie, lang) : "";
    const fields = {
      primary: [book.titre, book.auteur],
      secondary: [
        book.resume_court,
        book.resume_long,
        ...(book.tags || []),
        ...translatedTags,
        book.categorie,
        translatedCategory,
      ],
    };

    let primaryScore = 0;
    let secondaryScore = 0;

    for (const word of words) {
      let foundInPrimary = false;
      let foundInSecondary = false;

      // Cherche dans les champs primaires (titre, auteur)
      for (const field of fields.primary) {
        const match = matchesWord(field, word);
        if (match === "exact") {
          primaryScore += 100;
          foundInPrimary = true;
          break;
        } else if (match === "start") {
          primaryScore += 50;
          foundInPrimary = true;
          break;
        } else if (match === "word-start") {
          primaryScore += 30;
          foundInPrimary = true;
          break;
        }
      }

      // Si pas trouvé dans primaire, cherche dans secondaire
      if (!foundInPrimary) {
        for (const field of fields.secondary) {
          const match = matchesWord(String(field), word);
          if (match === "exact") {
            secondaryScore += 20;
            foundInSecondary = true;
            break;
          } else if (match === "start") {
            secondaryScore += 10;
            foundInSecondary = true;
            break;
          } else if (match === "word-start") {
            secondaryScore += 5;
            foundInSecondary = true;
            break;
          }
        }
      }

      // Si le mot n'est trouvé ni en primaire ni en secondaire, échec
      if (!foundInPrimary && !foundInSecondary) {
        return { matches: false, score: 0 };
      }
    }

    return { matches: true, score: primaryScore * 10 + secondaryScore };
  };

  const render = () => {
    const q = String(search.value || "").trim();
    const words = q ? q.split(/\s+/).filter(Boolean) : [];

    let filtered = books
      .map((b) => {
        if (activeTag !== "all") {
          const tags = uniqueNormalizedTags(b.tags);
          if (!tags.includes(activeTag)) return null;
        }

        if (words.length === 0) {
          return { book: b, score: 0 };
        }

        const result = searchBook(b, words);
        return result.matches ? { book: b, score: result.score } : null;
      })
      .filter(Boolean);

    // Trier par score décroissant
    filtered.sort((a, b) => b.score - a.score);

    if (count) count.textContent = formatCount(filtered.length, "bibliotheque.count");

    grid.innerHTML = filtered
      .map(({ book: b }) => b)
      .map((b) => {
        const tags =
          Array.isArray(b.tags) && b.tags.length > 0
            ? b.tags
                .slice(0, 3)
                .map((t) =>
                  `<span class="tag" style="opacity:.86">${escapeHtml(
                    lang === "en" ? translateTag(t, lang) : String(t)
                  )}</span>`
                )
                .join("")
            : "";
        const amazonHref = b.url_amazon ? escapeHtml(b.url_amazon) : "";
        const amazonAttrs = amazonHref ? `href="${amazonHref}" target="_blank" rel="noopener noreferrer"` : "";
        const amazon = amazonHref ? `<a class="bookLink" ${amazonAttrs} onclick="event.stopPropagation()">amazon</a>` : "";

        const coverInner = b.image
          ? `<img class="bookCoverImg" src="${escapeHtml(b.image)}" alt="Couverture : ${escapeHtml(
              b.titre || "Livre"
            )}" loading="lazy" />`
          : `<div class="bookCover" aria-hidden="true"></div>`;

        const detailPage = b.bd ? escapeHtml(b.bd) : "";
        const bookClass = detailPage ? "book clickable" : "book";
        const bookAttrs = detailPage ? `role="button" tabindex="0" style="cursor: pointer;"` : "";

        const categoryLabel = lang === "en" ? translateCategory(b.categorie, lang) : b.categorie;
        const categoryFallback = lang === "en" ? "other" : "autre";
        return `
          <article class="${bookClass}" ${bookAttrs} ${detailPage ? `data-detail="${detailPage}"` : ""}>
            <div class="bookCoverColumn">
              ${coverInner}
              ${amazon}
            </div>
            <div>
              <div class="tagRow">
                <span class="tag">${escapeHtml(normalizeCategory(categoryLabel) || categoryFallback)}</span>
                ${tags}
              </div>
              <h3>${escapeHtml(b.titre)}</h3>
              <p class="bookMeta">${escapeHtml(b.auteur)} — ${escapeHtml(b.resume_court || "")}</p>
            </div>
          </article>
        `;
      })
      .join("");
  };

  tagFilters?.addEventListener("click", (event) => {
    const btn = event.target instanceof HTMLElement ? event.target.closest("[data-tag]") : null;
    if (!btn) return;
    const next = btn.getAttribute("data-tag") || "all";
    activeTag = activeTag === next ? "all" : next;
    renderTagFilters();
    render();
  });

  search.addEventListener("input", render);

  grid.addEventListener("click", (event) => {
    const book = event.target instanceof HTMLElement ? event.target.closest("[data-detail]") : null;
    if (!book) return;
    const detailPage = book.getAttribute("data-detail");
    if (detailPage) window.location.href = appendLangParam(detailPage, lang);
  });

  grid.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const book = event.target instanceof HTMLElement ? event.target.closest("[data-detail]") : null;
    if (!book) return;
    event.preventDefault();
    const detailPage = book.getAttribute("data-detail");
    if (detailPage) window.location.href = appendLangParam(detailPage, lang);
  });

  (async () => {
    try {
      const resp = await fetch("../data/bibliotheque.json", { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      let livres = Array.isArray(data?.livres) ? data.livres : [];

      if (lang === "en") {
        try {
          const trResp = await fetch("../data/bibliotheque.en.json", { cache: "no-store" });
          if (trResp.ok) {
            const trData = await trResp.json();
            const translations = Array.isArray(trData?.livres) ? trData.livres : [];
            const byBd = new Map(translations.map((b) => [String(b?.bd || ""), b]));
            livres = livres.map((b) => {
              const key = String(b?.bd || "");
              if (!key || !byBd.has(key)) return b;
              return { ...b, ...byBd.get(key) };
            });
          }
        } catch (err) {
          console.warn("Unable to load English bibliotheque translation.", err);
        }
      }

      books = livres.map((b) => ({
        titre: String(b.titre || ""),
        auteur: String(b.auteur || ""),
        resume_court: String(b.resume_court || ""),
        resume_long: String(b.resume_long || ""),
        tags: uniqueNormalizedTags(b.tags),
        categorie: String(b.categorie || ""),
        url_amazon: b.url_amazon ? String(b.url_amazon) : "",
        image: b.image ? String(b.image) : "",
        bd: b.bd ? String(b.bd) : "",
      }));
    } catch (e) {
      console.error(e);
      books = [];
    }

    renderTagFilters();
    render();

    if (books.length === 0) {
      grid.innerHTML = `
        <article class="infoCard">
          <h3>${t("bibliotheque.unavailableTitle")}</h3>
          <p>${t("bibliotheque.unavailableBody")}</p>
          <p class="muted tiny">${t("bibliotheque.unavailableHint")}</p>
        </article>
      `;
    }
  })();
}

function setupBookDetailPage() {
  if (document.body.dataset.page !== "book-detail") return;

  const mount = $("#bookDetailMount");
  if (!mount) return;

  const lang = currentLang;
  const bd = String(document.body.dataset.book || "").trim();
  if (!bd) {
    mount.innerHTML = `
      <article class="infoCard">
        <h3>${t("bookDetail.missingTitle")}</h3>
        <p>${t("bookDetail.missingBody")}</p>
        <p class="muted tiny">${t("bookDetail.missingHint")}</p>
      </article>
    `;
    return;
  }

  const normalizeTag = (tag) =>
    String(tag || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  const uniqueNormalizedTags = (tags) => {
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

  const render = (book) => {
    const title = String(book.titre || "");
    const author = String(book.auteur || "");
    const cover = book.image ? String(book.image) : "";
    const amazon = book.url_amazon ? String(book.url_amazon) : "";
    const wikipedia = book.url_wikipedia ? String(book.url_wikipedia) : "";
    const tags = uniqueNormalizedTags(book.tags);
    const categorie = String(book.categorie || "").trim().toLowerCase();
    const categoryLabel = lang === "en" ? translateCategory(categorie, lang) : categorie;

    const why = Array.isArray(book.pourquoi_entrepreneur)
      ? book.pourquoi_entrepreneur.map((p) => String(p)).filter(Boolean)
      : typeof book.pourquoi_entrepreneur === "string"
        ? [book.pourquoi_entrepreneur]
        : [];

    const tagsHtml = [
      ...(categoryLabel ? [`<span class="tag">${escapeHtml(categoryLabel)}</span>`] : []),
      ...tags.slice(0, 6).map((t) => `<span class="tag">${escapeHtml(lang === "en" ? translateTag(t, lang) : t)}</span>`),
    ].join("");

    const links = [
      amazon
        ? `<a class="detailLink" href="${escapeHtml(amazon)}" target="_blank" rel="noopener noreferrer">${t(
            "bookDetail.amazon"
          )}</a>`
        : "",
      wikipedia
        ? `<a class="detailLink" href="${escapeHtml(wikipedia)}" target="_blank" rel="noopener noreferrer">${t(
            "bookDetail.wikipedia"
          )}</a>`
        : "",
    ]
      .filter(Boolean)
      .join("");

    const whyHtml =
      why.length > 0
        ? `
            <h2>${t("bookDetail.whyTitle")}</h2>
            <ul>
              ${why.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}
            </ul>
          `
        : "";

    mount.innerHTML = `
      <div class="bookDetail">
          <div class="bookDetailHeader">
          <div class="bookDetailCover">
            ${
              cover
                ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(t("bookDetail.coverAlt", { title }))}" />`
                : ""
            }
          </div>
          <div class="bookDetailInfo">
            <p class="author">${escapeHtml(title)}${author ? ` — ${escapeHtml(author)}` : ""}</p>
            <div class="tagsRow">
              <div class="tags">${tagsHtml}</div>
              ${links ? `<div class="links">${links}</div>` : ""}
            </div>
            ${book.resume_court ? `<p style="margin-bottom: 1.25rem;">${escapeHtml(String(book.resume_court))}</p>` : ""}
            <div class="bookDetailContent">
              <h2>${t("bookDetail.summaryTitle")}</h2>
              ${book.resume_long ? `<p>${escapeHtml(String(book.resume_long))}</p>` : ""}
              ${
                wikipedia
                  ? `<p class="bookDetailSourceNote">${t("bookDetail.sourceNote", {
                      source: `<a href="${escapeHtml(wikipedia)}" target="_blank" rel="noopener noreferrer">Wikipedia</a>`,
                    })}</p>`
                  : ""
              }
              ${whyHtml}
            </div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 2rem;">
          <a href="${appendLangParam("bibliotheque.html", lang)}" style="color: rgba(255, 255, 255, 0.7); text-decoration: none;">${t(
            "bookDetail.back"
          )}</a>
        </div>
      </div>
    `;

    if (title) document.title = `${title} — The Entrepreneur Whisperer`;
    const meta = $("meta[name='description']");
    if (meta && book.resume_court) meta.setAttribute("content", String(book.resume_court));
  };

  (async () => {
    try {
      const resp = await fetch("../data/bibliotheque.json", { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      let livres = Array.isArray(data?.livres) ? data.livres : [];

      if (lang === "en") {
        try {
          const trResp = await fetch("../data/bibliotheque.en.json", { cache: "no-store" });
          if (trResp.ok) {
            const trData = await trResp.json();
            const translations = Array.isArray(trData?.livres) ? trData.livres : [];
            const byBd = new Map(translations.map((b) => [String(b?.bd || ""), b]));
            livres = livres.map((b) => {
              const key = String(b?.bd || "");
              if (!key || !byBd.has(key)) return b;
              return { ...b, ...byBd.get(key) };
            });
          }
        } catch (err) {
          console.warn("Unable to load English bibliotheque translation.", err);
        }
      }

      const found = livres.find((b) => String(b?.bd || "") === bd);
      if (!found) throw new Error(`Book not found for bd=${bd}`);
      render(found);
    } catch (e) {
      console.error(e);
      mount.innerHTML = `
        <article class="infoCard">
          <h3>${t("bookDetail.notFoundTitle")}</h3>
          <p>${t("bookDetail.notFoundBody")}</p>
          <p class="muted tiny">${t("bookDetail.notFoundDetail", { detail: escapeHtml(String(e?.message || e)) })}</p>
        </article>
      `;
    }
  })();
}

function setupPlayPlaceholder() {
  const btn = $(".playButton");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const message = t("playPlaceholder");
    btn.querySelector("span:last-child").textContent = message;
  });
}

function init() {
  initLanguage();
  applyMeta();
  applyI18n();
  applyNavI18n();
  setupLangToggle();
  updateInternalLinks();
  setYear();
  setupMobileNav();
  setupRevealOnScroll();
  setupPulseSections();
  setupPlayPlaceholder();
  setupAssistantPage();
  setupConseilsPage();
  setupBibliothequePage();
  setupBookDetailPage();
}

document.addEventListener("DOMContentLoaded", init);
