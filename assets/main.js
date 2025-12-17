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
  const filtersContainer = $(".filters");
  if (!grid || !search || !filtersContainer) return;

  let activeFilter = "all";
  let conseils = [];

  // Create and insert the count element
  const count = document.createElement("p");
  count.className = "muted tiny";
  count.id = "conseilsCount";
  count.setAttribute("aria-live", "polite");
  search.parentElement.insertBefore(count, filtersContainer.nextSibling);

  const searchConseil = (conseil, words) => {
    const fields = {
      primary: [conseil.titre, ...(conseil.tags || [])],
      secondary: [conseil.resume_court, conseil.resume_long, conseil.descriptif_long]
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
        const uniqueTags = [...new Set((c.tags || []).map(tag => tag.toLowerCase()))];
        const matchesFilter = activeFilter === "all" ? true : uniqueTags.includes(activeFilter);
        if (!matchesFilter) return null;
        
        if (words.length === 0) {
          return { conseil: c, score: 0 };
        }

        const result = searchConseil(c, words);
        return result.matches ? { conseil: c, score: result.score } : null;
      })
      .filter(Boolean);

    filtered.sort((a, b) => b.score - a.score);
    
    count.textContent = `${filtered.length} conseil${filtered.length > 1 ? "s" : ""}`;

    grid.innerHTML = filtered
      .map(({ conseil: c }) => {
        const tags = (c.tags || [])
          .slice(0, 3)
          .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
          .join("");

        const imageSrc = c.nom_image ? `../${escapeHtml(c.nom_image)}` : '';
        const audioSrc = c.nom_fichier_audio ? `../${escapeHtml(c.nom_fichier_audio)}` : '';

        return `
          <article class="card" tabindex="0" role="button" style="display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <h3>${escapeHtml(c.titre)}</h3>
              ${imageSrc ? `<img src="${imageSrc}" alt="Visual for ${escapeHtml(c.titre)}" width="300" style="margin-top: 8px; margin-bottom: 16px; border-radius: 8px; max-width: 100%;">` : ''}
              <p>${escapeHtml(c.resume_court)}</p>
            </div>
            <div>
              ${audioSrc ? `<audio controls preload="none" style="width: 100%; margin-top: 16px;"><source src="${audioSrc}" type="audio/mpeg">Your browser does not support the audio element.</audio>` : ''}
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
      conseils = Array.isArray(data?.conseils) ? data.conseils : [];
    } catch(e) {
      console.error(e);
      conseils = [];
    }
    // Don't auto-update filters, use the ones from the HTML
    // updateFilters(); 
    render();

    if (conseils.length === 0) {
      grid.innerHTML = `
        <article class="infoCard">
          <h3>Conseils indisponibles</h3>
          <p>Impossible de charger <code>data/conseils.json</code>.</p>
        </article>
      `;
    }
  })();
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
    const fields = {
      primary: [book.titre, book.auteur],
      secondary: [
        book.resume_court,
        book.resume_long,
        ...(book.tags || []),
        book.categorie
      ]
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
        const matchesFilter = activeFilter === "all" ? true : normalizeCategory(b.categorie) === activeFilter;
        if (!matchesFilter) return null;

        if (words.length === 0) {
          return { book: b, score: 0 };
        }

        const result = searchBook(b, words);
        return result.matches ? { book: b, score: result.score } : null;
      })
      .filter(Boolean);

    // Trier par score décroissant
    filtered.sort((a, b) => b.score - a.score);

    if (count) count.textContent = `${filtered.length} livre${filtered.length > 1 ? "s" : ""}`;

    grid.innerHTML = filtered
      .map(({ book: b }) => b)
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
        const amazon = amazonHref ? `<a class="bookLink" ${amazonAttrs} onclick="event.stopPropagation()">amazon</a>` : "";

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
            <div class="bookCoverColumn">
              ${coverInner}
              ${amazon}
            </div>
            <div>
              <div class="tagRow">
                <span class="tag">${escapeHtml(normalizeCategory(b.categorie) || "autre")}</span>
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
      const resp = await fetch("../data/bibliotheque.json", { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const livres = Array.isArray(data?.livres) ? data.livres : [];
      books = livres.map((b) => ({
        titre: String(b.titre || ""),
        auteur: String(b.auteur || ""),
        resume_court: String(b.resume_court || ""),
        resume_long: String(b.resume_long || ""),
        tags: Array.isArray(b.tags) ? b.tags : [],
        categorie: String(b.categorie || ""),
        url_amazon: b.url_amazon ? String(b.url_amazon) : "",
        image: b.image ? String(b.image) : "",
        bd: b.bd ? String(b.bd) : "",
      }));
    } catch (e) {
      console.error(e);
      books = [];
    }

    renderFilters();
    render();

    if (books.length === 0) {
      grid.innerHTML = `
        <article class="infoCard">
          <h3>Bibliothèque indisponible</h3>
          <p>Impossible de charger <code>../data/bibliotheque.json</code>.</p>
          <p class="muted tiny">Astuce : vérifiez que vous servez le dossier du projet (pas seulement <code>pages/</code>).</p>
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
