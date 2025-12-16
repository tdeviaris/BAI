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
    toggle.querySelector(".srOnly").textContent = open ? "Fermer le menu" : "Ouvrir le menu";
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

function setupAssistantPage() {
  if (document.body.dataset.page !== "assistant") return;

  const stream = $("#chatStream");
  const form = $("#chatForm");
  const input = $("#chatInput");
  if (!stream || !form || !input) return;

  const knowledgeBase = [
    {
      title: "Roadmap produit : prioriser",
      tags: ["produit", "priorisation", "roadmap"],
      answer:
        "Priorise avec une règle simple : (1) douleur client prouvée, (2) impact sur un metric clé, (3) effort faible. Évite les ‘features vitrine’. Fais un top 3, pas un top 30. Découpe en tickets livrables en <2 semaines.",
      examples: ["Comment prioriser ma roadmap produit ?", "Quelle méthode simple pour prioriser ?"],
    },
    {
      title: "Pricing : point de départ",
      tags: ["pricing", "vente"],
      answer:
        "Commence par la valeur : qui paie, pour quel résultat. Fixe 3 offres (starter / core / premium) et ancre le prix avec la premium. Itère vite : 10 conversations, 10 objections, 10 ajustements.",
      examples: ["Comment fixer un prix au début ?", "Comment tester mon pricing ?"],
    },
    {
      title: "Prospection : cadence",
      tags: ["vente", "prospection"],
      answer:
        "Cadence courte : une liste de 50 comptes, 10 touches sur 14 jours, un message orienté problème, et un CTA minimal (15 min). Mesure : réponses, rendez-vous, conversion. Améliore le copy avant de scaler le volume.",
      examples: ["Comment structurer une prospection B2B ?", "Quelle cadence de relance ?"],
    },
    {
      title: "Focus : limiter le scope",
      tags: ["execution", "focus"],
      answer:
        "Réduis à une seule priorité par semaine. Tout le reste doit avoir une date ou être supprimé. Décide en coût d’opportunité : dire oui = dire non à quelque chose de plus important.",
      examples: ["Comment garder le focus au quotidien ?", "Comment éviter la dispersion ?"],
    },
  ];

  const pushBubble = ({ who, title, text }) => {
    const el = document.createElement("div");
    el.className = `bubble ${who}`;
    const titleHtml = title ? `<p class="bubbleTitle">${escapeHtml(title)}</p>` : "";
    el.innerHTML = `${titleHtml}<p class="bubbleText">${escapeHtml(text)}</p>`;
    stream.appendChild(el);
    stream.scrollTop = stream.scrollHeight;
  };

  pushBubble({
    who: "bot",
    title: "Bienvenue",
    text: "Pose une question. (MVP démo : base de connaissance locale.)",
  });

  const showExamples = () => {
    pushBubble({
      who: "bot",
      title: "Exemples",
      text: knowledgeBase
        .flatMap((k) => k.examples)
        .slice(0, 6)
        .map((q) => `• ${q}`)
        .join("\n"),
    });
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const q = String(input.value || "").trim();
    if (!q) return;
    input.value = "";

    pushBubble({ who: "me", title: "Vous", text: q });

    if (q.toLowerCase() === "exemples") {
      showExamples();
      return;
    }

    const ranked = knowledgeBase
      .map((k) => ({
        k,
        score: Math.max(similarityScore(q, k.title), similarityScore(q, k.tags.join(" ")), similarityScore(q, k.answer)),
      }))
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    if (!best || best.score < 10) {
      pushBubble({
        who: "bot",
        title: "Je n’ai pas (encore) ça dans la base",
        text: "Essaie avec d’autres mots-clés (ex: produit, pricing, prospection, focus) ou tape “exemples”.",
      });
      return;
    }

    pushBubble({
      who: "bot",
      title: best.k.title,
      text: best.k.answer,
    });
  });
}

function setupConseilsPage() {
  if (document.body.dataset.page !== "conseils") return;

  const grid = $("#conseilsGrid");
  const search = $("#search");
  const chips = $$("[data-filter]");
  const modal = $("#conseilModal");
  const modalTheme = $("#modalTheme");
  const modalTitle = $("#modalTitle");
  const modalBody = $("#modalBody");
  const comic = $("#comic");
  const speakBtn = $("#speakBtn");
  const stopSpeakBtn = $("#stopSpeakBtn");

  if (!grid || !search) return;

  const staticCards = $$(".conseil-card", grid);
  if (staticCards.length > 0) {
    const applySearch = () => {
      const q = String(search.value || "").trim().toLowerCase();
      for (const card of staticCards) {
        const hay = (card.textContent || "").toLowerCase();
        const isMatch = !q ? true : hay.includes(q);
        card.style.display = isMatch ? "" : "none";
      }
    };
    search.addEventListener("input", applySearch);
    applySearch();
    return;
  }

  if (chips.length === 0 || !modal || !modalTheme || !modalTitle || !modalBody || !comic) return;

  const conseils = [
    {
      id: "scope",
      theme: "execution",
      title: "Réduis le scope jusqu’à ce que ça fasse peur",
      body: "Un MVP n’est pas ‘la version 1’. C’est le plus petit paquet qui teste ton hypothèse. Tout le reste est une distraction.",
      tags: ["mvp", "focus", "priorisation"],
    },
    {
      id: "pricing-anchor",
      theme: "vente",
      title: "Ancre ton pricing avec une offre premium",
      body: "3 niveaux suffisent. La premium sert d’ancre, la core devient la décision par défaut. Ton job : clarifier la différence de valeur.",
      tags: ["pricing", "offres", "valeur"],
    },
    {
      id: "user-interviews",
      theme: "produit",
      title: "10 interviews avant 10 features",
      body: "Cherche les phrases exactes du client (douleur, contexte, alternative). Ce vocabulaire est ton meilleur copy marketing.",
      tags: ["interviews", "discovery", "copy"],
    },
    {
      id: "cadence",
      theme: "vente",
      title: "Cadence de prospection : courte, mesurée, itérée",
      body: "Teste un message, une cible, un CTA. Mesure les réponses avant d’augmenter le volume. La qualité du ciblage bat la quantité.",
      tags: ["prospection", "b2b", "copy"],
    },
    {
      id: "rituals",
      theme: "equipe",
      title: "Rituels d’équipe : moins, mais nets",
      body: "Une weekly (priorités), un review (apprentissage), un 1:1 (frictions). Si un rituel n’aide pas une décision, supprime-le.",
      tags: ["management", "rituels", "decision"],
    },
    {
      id: "roadmap",
      theme: "produit",
      title: "Roadmap : écris des outcomes, pas des features",
      body: "Remplace ‘build X’ par ‘augmenter Y’. Tu libères l’équipe pour trouver la meilleure solution, et tu peux dire non plus facilement.",
      tags: ["roadmap", "metrics", "priorisation"],
    },
  ];

  let activeFilter = "all";
  let speechUtterance = null;

  const render = () => {
    const q = String(search.value || "").trim().toLowerCase();
    const filtered = conseils.filter((c) => {
      const matchesFilter = activeFilter === "all" ? true : c.theme === activeFilter;
      const hay = `${c.title} ${c.body} ${c.tags.join(" ")}`.toLowerCase();
      const matchesQuery = !q ? true : hay.includes(q);
      return matchesFilter && matchesQuery;
    });

    grid.innerHTML = filtered
      .map(
        (c) => `
        <article class="card" data-id="${escapeHtml(c.id)}" tabindex="0" role="button" aria-label="Ouvrir : ${escapeHtml(
          c.title
        )}">
          <div class="tagRow">
            <span class="tag">${escapeHtml(c.theme)}</span>
            ${c.tags
              .slice(0, 2)
              .map((t) => `<span class="tag" style="opacity:.86">${escapeHtml(t)}</span>`)
              .join("")}
          </div>
          <h3>${escapeHtml(c.title)}</h3>
          <p>${escapeHtml(c.body)}</p>
        </article>
      `
      )
      .join("");
  };

  const openModal = (id) => {
    const c = conseils.find((x) => x.id === id);
    if (!c) return;

    modalTheme.textContent = c.theme;
    modalTitle.textContent = c.title;
    modalBody.textContent = c.body;
    comic.innerHTML = makeComicPanels(c);
    modal.showModal();
  };

  const stopSpeech = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    speechUtterance = null;
  };

  const speak = () => {
    stopSpeech();
    if (!("speechSynthesis" in window)) return;
    const text = `${modalTitle.textContent}. ${modalBody.textContent}`;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    u.rate = 1.02;
    u.pitch = 1.0;
    speechUtterance = u;
    window.speechSynthesis.speak(u);
  };

  const makeComicPanels = (c) => {
    const captions = [
      `“On fait tout ça ?”`,
      `“Non. On choisit l’essentiel.”`,
      `“Ok. Et on mesure.”`,
    ];
    const themeAccent =
      c.theme === "vente"
        ? "rgba(244, 63, 94, 0.35)"
        : c.theme === "produit"
          ? "rgba(56, 189, 248, 0.35)"
          : c.theme === "equipe"
            ? "rgba(168, 85, 247, 0.35)"
            : "rgba(34, 197, 94, 0.35)";

    return captions
      .map(
        (caption, i) => `
        <div class="panel">
          <div class="panelArt" style="background:
            radial-gradient(240px 120px at 30% 30%, ${themeAccent}, rgba(0,0,0,0) 70%),
            radial-gradient(220px 120px at 80% 20%, rgba(255, 0, 153, 0.22), rgba(0,0,0,0) 70%),
            radial-gradient(220px 120px at 55% 90%, rgba(56, 189, 248, 0.18), rgba(0,0,0,0) 70%);">
          </div>
          <div class="panelCaption">${escapeHtml(caption)}</div>
        </div>
      `
      )
      .join("");
  };

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("isActive"));
      chip.classList.add("isActive");
      activeFilter = chip.getAttribute("data-filter") || "all";
      render();
    });
  });
  search.addEventListener("input", render);

  grid.addEventListener("click", (event) => {
    const card = event.target instanceof HTMLElement ? event.target.closest("[data-id]") : null;
    if (!card) return;
    openModal(card.getAttribute("data-id"));
  });
  grid.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target instanceof HTMLElement ? event.target.closest("[data-id]") : null;
    if (!card) return;
    event.preventDefault();
    openModal(card.getAttribute("data-id"));
  });

  modal.addEventListener("close", stopSpeech);
  if (speakBtn) speakBtn.addEventListener("click", speak);
  if (stopSpeakBtn) stopSpeakBtn.addEventListener("click", stopSpeech);

  render();
}

function setupBibliothequePage() {
  if (document.body.dataset.page !== "bibliotheque") return;

  const grid = $("#bookGrid");
  const search = $("#bookSearch");
  const filters = $("#bookFilters");
  const count = $("#bookCount");
  if (!grid || !search || !filters) return;

  let activeFilter = "all";
  let books = [];

  const normalizeCategory = (category) =>
    String(category || "")
      .trim()
      .toLowerCase()
      .replaceAll(" ", "-");

  const labelizeCategory = (category) => {
    const c = String(category || "").trim();
    if (!c) return "Autre";
    return c.charAt(0).toUpperCase() + c.slice(1);
  };

  const renderFilters = () => {
    const categories = [...new Set(books.map((b) => b.categorie).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    filters.innerHTML = [
      `<button class="chip ${activeFilter === "all" ? "isActive" : ""}" type="button" data-filter="all">Tous</button>`,
      ...categories.map((c) => {
        const key = normalizeCategory(c);
        const isActive = activeFilter === key;
        return `<button class="chip ${isActive ? "isActive" : ""}" type="button" data-filter="${escapeHtml(
          key
        )}">${escapeHtml(labelizeCategory(c))}</button>`;
      }),
    ].join("");
  };

  const render = () => {
    const q = String(search.value || "").trim().toLowerCase();
    const filtered = books.filter((b) => {
      const matchesFilter = activeFilter === "all" ? true : normalizeCategory(b.categorie) === activeFilter;
      const hay = `${b.titre} ${b.auteur} ${b.resume_court} ${(b.tags || []).join(" ")} ${b.categorie}`.toLowerCase();
      const matchesQuery = !q ? true : hay.includes(q);
      return matchesFilter && matchesQuery;
    });

    if (count) count.textContent = `${filtered.length} livre${filtered.length > 1 ? "s" : ""}`;

    grid.innerHTML = filtered
      .map((b) => {
        const tags =
          Array.isArray(b.tags) && b.tags.length > 0
            ? b.tags
                .slice(0, 3)
                .map((t) => `<span class="tag" style="opacity:.86">${escapeHtml(String(t))}</span>`)
                .join("")
            : "";
        const amazonHref = b.url_amazon ? escapeHtml(b.url_amazon) : "";
        const amazonAttrs = amazonHref ? `href="${amazonHref}" target="_blank" rel="noopener noreferrer"` : "";
        const amazon = amazonHref ? `<a class="bookLink" ${amazonAttrs} onclick="event.stopPropagation()">Amazon</a>` : "";

        const coverInner = b.image
          ? `<img class="bookCoverImg" src="${escapeHtml(b.image)}" alt="Couverture : ${escapeHtml(
              b.titre || "Livre"
            )}" loading="lazy" />`
          : `<div class="bookCover" aria-hidden="true"></div>`;

        const detailPage = b.bd ? escapeHtml(b.bd) : "";
        const bookClass = detailPage ? "book clickable" : "book";
        const bookAttrs = detailPage ? `role="button" tabindex="0" style="cursor: pointer;"` : "";

        return `
          <article class="${bookClass}" ${bookAttrs} ${detailPage ? `data-detail="${detailPage}"` : ""}>
            ${coverInner}
            <div>
              <div class="tagRow">
                <span class="tag">${escapeHtml(normalizeCategory(b.categorie) || "autre")}</span>
                ${tags}
              </div>
              <h3>${escapeHtml(b.titre)}</h3>
              <p class="bookMeta">${escapeHtml(b.auteur)} — ${escapeHtml(b.resume_court || "")}</p>
              ${amazon}
            </div>
          </article>
        `;
      })
      .join("");
  };

  filters.addEventListener("click", (event) => {
    const btn = event.target instanceof HTMLElement ? event.target.closest("[data-filter]") : null;
    if (!btn) return;
    activeFilter = btn.getAttribute("data-filter") || "all";
    renderFilters();
    render();
  });

  search.addEventListener("input", render);

  grid.addEventListener("click", (event) => {
    const book = event.target instanceof HTMLElement ? event.target.closest("[data-detail]") : null;
    if (!book) return;
    const detailPage = book.getAttribute("data-detail");
    if (detailPage) window.location.href = detailPage;
  });

  grid.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const book = event.target instanceof HTMLElement ? event.target.closest("[data-detail]") : null;
    if (!book) return;
    event.preventDefault();
    const detailPage = book.getAttribute("data-detail");
    if (detailPage) window.location.href = detailPage;
  });

  (async () => {
    try {
      const resp = await fetch("data/bibliotheque.json", { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const livres = Array.isArray(data?.livres) ? data.livres : [];
      books = livres.map((b) => ({
        titre: String(b.titre || ""),
        auteur: String(b.auteur || ""),
        resume_court: String(b.resume_court || ""),
        tags: Array.isArray(b.tags) ? b.tags : [],
        categorie: String(b.categorie || ""),
        url_amazon: b.url_amazon ? String(b.url_amazon) : "",
        image: b.image ? String(b.image) : "",
        bd: b.bd ? String(b.bd) : "",
      }));
    } catch {
      books = [];
    }

    renderFilters();
    render();

    if (books.length === 0) {
      grid.innerHTML = `
        <article class="infoCard">
          <h3>Bibliothèque indisponible</h3>
          <p>Impossible de charger <code>data/bibliotheque.json</code>.</p>
          <p class="muted tiny">Astuce : lancez le site via <code>python3 -m http.server 8080</code>.</p>
        </article>
      `;
    }
  })();
}

function setupPlayPlaceholder() {
  const btn = $(".playButton");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const message = "Placeholder : remplacez ce bloc par un embed (YouTube/Spotify) ou un lecteur audio/vidéo.";
    btn.querySelector("span:last-child").textContent = message;
  });
}

function init() {
  setYear();
  setupMobileNav();
  setupRevealOnScroll();
  setupPulseSections();
  setupPlayPlaceholder();
  setupAssistantPage();
  setupConseilsPage();
  setupBibliothequePage();
}

document.addEventListener("DOMContentLoaded", init);
