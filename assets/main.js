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

  const exampleQuestions = [
    "À quels investissements donner la priorité en période de crise ?",
    "Comment structurer la rémunération des commerciaux ?",
    "Comment optimiser une tarification B2B ?",
    "Qu’est-ce que l’effectuation et comment l’appliquer ?",
    "Comment appliquer la théorie des contraintes (TOC) au quotidien ?",
    "Quels leviers pour améliorer mon organisation (Lean / Deming) ?",
  ];

  const conversation = [];

  const pushBubble = ({ who, title, text }) => {
    const el = document.createElement("div");
    el.className = `bubble ${who}`;
    const titleHtml = title ? `<p class="bubbleTitle">${escapeHtml(title)}</p>` : "";
    el.innerHTML = `${titleHtml}<p class="bubbleText">${escapeHtml(text)}</p>`;
    stream.appendChild(el);
    stream.scrollTop = stream.scrollHeight;
    return el;
  };

  pushBubble({
    who: "bot",
    title: "Bienvenue",
    text: "Pose une question. (Réponses basées sur la base de connaissance.)",
  });

  const showExamples = () => {
    pushBubble({
      who: "bot",
      title: "Exemples",
      text: exampleQuestions
        .slice(0, 8)
        .map((q) => `• ${q}`)
        .join("\n"),
    });
  };

  form.addEventListener("submit", (event) => {
    (async () => {
      event.preventDefault();
      const q = String(input.value || "").trim();
      if (!q) return;
      input.value = "";

      const historyForServer = conversation.slice();
      conversation.push({ role: "user", content: q });
      pushBubble({ who: "me", title: "Vous", text: q });

      if (q.toLowerCase() === "exemples") {
        showExamples();
        return;
      }

      const submitBtn = form.querySelector("button[type='submit']");
      if (submitBtn) submitBtn.disabled = true;
      input.disabled = true;

      const placeholder = pushBubble({ who: "bot", title: "Assistant", text: "Je réfléchis…" });

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
            placeholder.querySelector(".bubbleText").textContent = `${answer || "Je n’ai pas de réponse pour le moment."}${sourcesText}${debugText}`;
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
                  placeholder.querySelector(".bubbleText").textContent = answer;
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
        } else {
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) throw new Error(data?.error || `Erreur API (${resp.status})`);

          const answer = String(data?.answer || "").trim() || "Je n’ai pas de réponse pour le moment.";
          const sources = Array.isArray(data?.sources) ? data.sources : [];
          const debug = data?.debug && typeof data.debug === "object" ? data.debug : null;
          const sourcesText = "";
          const debugText =
            debug
              ? `\n\nDiagnostic (tech) :\n• status: ${String(debug.status || "")}\n• error: ${String(
                  debug.error || ""
                )}\n• incomplete: ${String(debug.incomplete_reason || "")}`
              : "";

          placeholder.querySelector(".bubbleText").textContent = `${answer}${sourcesText}${debugText}`;
          conversation.push({ role: "assistant", content: answer });
        }
      } catch (err) {
        placeholder.querySelector(".bubbleText").textContent = `Désolé, je n’arrive pas à répondre.\n${err?.message || ""}`.trim();
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
  const tagFilters = $("#tagFilters");
  const count = $("#bookCount");
  if (!grid || !search) return;

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
      `<button class="chip ${activeTag === "all" ? "isActive" : ""}" type="button" data-tag="all">tous</button>`,
      ...tagsSorted.map((t) => {
        const isActive = activeTag === t;
        return `<button class="chip ${isActive ? "isActive" : ""}" type="button" data-tag="${escapeHtml(t)}">${escapeHtml(
          t
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
          <h3>Bibliothèque indisponible</h3>
          <p>Impossible de charger <code>../data/bibliotheque.json</code>.</p>
          <p class="muted tiny">Astuce : vérifiez que vous servez le dossier du projet (pas seulement <code>pages/</code>).</p>
        </article>
      `;
    }
  })();
}

function setupBookDetailPage() {
  if (document.body.dataset.page !== "book-detail") return;

  const mount = $("#bookDetailMount");
  if (!mount) return;

  const bd = String(document.body.dataset.book || "").trim();
  if (!bd) {
    mount.innerHTML = `
      <article class="infoCard">
        <h3>Page introuvable</h3>
        <p>Cette page ne sait pas quel livre afficher.</p>
        <p class="muted tiny">Astuce : ajoutez <code>data-book</code> sur <code>&lt;body&gt;</code>.</p>
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

    const why = Array.isArray(book.pourquoi_entrepreneur)
      ? book.pourquoi_entrepreneur.map((p) => String(p)).filter(Boolean)
      : typeof book.pourquoi_entrepreneur === "string"
        ? [book.pourquoi_entrepreneur]
        : [];

    const tagsHtml = [
      ...(categorie ? [`<span class="tag">${escapeHtml(categorie)}</span>`] : []),
      ...tags.slice(0, 6).map((t) => `<span class="tag">${escapeHtml(t)}</span>`),
    ].join("");

    const links = [
      amazon
        ? `<a class="detailLink" href="${escapeHtml(amazon)}" target="_blank" rel="noopener noreferrer">Voir sur Amazon</a>`
        : "",
      wikipedia
        ? `<a class="detailLink" href="${escapeHtml(wikipedia)}" target="_blank" rel="noopener noreferrer">Wikipedia</a>`
        : "",
    ]
      .filter(Boolean)
      .join("");

    const whyHtml =
      why.length > 0
        ? `
            <h2>Pourquoi c'est utile pour un entrepreneur</h2>
            <ul>
              ${why.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}
            </ul>
          `
        : "";

    mount.innerHTML = `
      <div class="bookDetail">
        <div class="bookDetailHeader">
          <div class="bookDetailCover">
            ${cover ? `<img src="${escapeHtml(cover)}" alt="Couverture du livre ${escapeHtml(title)}" />` : ""}
          </div>
          <div class="bookDetailInfo">
            <p class="author">${escapeHtml(title)}${author ? ` — ${escapeHtml(author)}` : ""}</p>
            <div class="tagsRow">
              <div class="tags">${tagsHtml}</div>
              ${links ? `<div class="links">${links}</div>` : ""}
            </div>
            ${book.resume_court ? `<p style="margin-bottom: 1.25rem;">${escapeHtml(String(book.resume_court))}</p>` : ""}
            <div class="bookDetailContent">
              <h2>Résumé</h2>
              ${book.resume_long ? `<p>${escapeHtml(String(book.resume_long))}</p>` : ""}
              ${
                wikipedia
                  ? `<p class="bookDetailSourceNote">Source complémentaire : <a href="${escapeHtml(
                      wikipedia
                    )}" target="_blank" rel="noopener noreferrer">Wikipedia</a>.</p>`
                  : ""
              }
              ${whyHtml}
            </div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 2rem;">
          <a href="bibliotheque.html" style="color: rgba(255, 255, 255, 0.7); text-decoration: none;">← Retour à la bibliothèque</a>
        </div>
      </div>
    `;

    if (title) document.title = `${title} — The Entrepreneur Whisperer`;
  };

  (async () => {
    try {
      const resp = await fetch("../data/bibliotheque.json", { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const livres = Array.isArray(data?.livres) ? data.livres : [];
      const found = livres.find((b) => String(b?.bd || "") === bd);
      if (!found) throw new Error(`Book not found for bd=${bd}`);
      render(found);
    } catch (e) {
      console.error(e);
      mount.innerHTML = `
        <article class="infoCard">
          <h3>Livre introuvable</h3>
          <p>Impossible de charger ce livre depuis <code>../data/bibliotheque.json</code>.</p>
          <p class="muted tiny">Détail : ${escapeHtml(String(e?.message || e))}</p>
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
  setupBookDetailPage();
}

document.addEventListener("DOMContentLoaded", init);
