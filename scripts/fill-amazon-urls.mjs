import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PROJECT_ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const DATA_PATH = path.join(PROJECT_ROOT, "data", "bibliotheque.json");

const normalizeLoose = (input) =>
  String(input || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

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

const isbn13to10 = (isbn13) => {
  const s = String(isbn13 || "").replace(/[^0-9X]/gi, "");
  if (!/^97[89]\d{10}$/.test(s)) return null;
  const core = s.slice(3, 12);
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

const openLibrarySearch = async ({ title, author }) => {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("title", title);
  if (author) url.searchParams.set("author", author);
  url.searchParams.set("limit", "10");
  url.searchParams.set("fields", "title,author_name,isbn,key,cover_i");
  const resp = await fetch(url.toString(), { headers: { "user-agent": "BAI/1.0" } });
  if (!resp.ok) throw new Error(`OpenLibrary HTTP ${resp.status}`);
  return resp.json();
};

const titleCandidates = (title) => {
  const t = String(title || "").trim();
  const out = [t];
  const beforeColon = t.split(":")[0]?.trim();
  if (beforeColon && beforeColon !== t) out.push(beforeColon);
  const withoutLeadingThe = t.replace(/^the\s+/i, "").trim();
  if (withoutLeadingThe && withoutLeadingThe !== t) out.push(withoutLeadingThe);
  const beforeParen = t.split("(")[0]?.trim();
  if (beforeParen && beforeParen !== t) out.push(beforeParen);

  // Manual fallbacks for known translations
  if (/strat[ée]gie oc[ée]an bleu/i.test(t)) out.push("Blue Ocean Strategy");
  if (/gold mine/i.test(t)) out.push("Gold Mine");
  if (/lean manager/i.test(t)) out.push("Lean Manager");
  if (/lean thinking/i.test(t)) out.push("Lean Thinking");
  if (/drive/i.test(t)) out.push("Drive");

  return [...new Set(out.filter(Boolean))];
};

const authorCandidates = (authorRaw) => {
  const raw = String(authorRaw || "").trim();
  if (!raw) return [""];
  const first = raw.split(",")[0]?.trim() || raw;
  const last = first.split(/\s+/).filter(Boolean).slice(-1)[0] || first;
  return [...new Set([raw, first, last].filter(Boolean))];
};

const resolveAmazonUrl = async ({ title, author }) => {
  for (const t of titleCandidates(title)) {
    for (const a of authorCandidates(author)) {
      const data = await openLibrarySearch({ title: t, author: a });
      const docs = Array.isArray(data?.docs) ? data.docs : [];
      if (docs.length === 0) continue;
      docs.sort((x, y) => scoreDoc(title, y) - scoreDoc(title, x));
      const best = docs[0];
      const isbn10 = pickIsbn10(best);
      if (!isbn10) continue;
      return { url: `https://www.amazon.fr/dp/${isbn10}`, isbn10 };
    }
  }
  return { url: "", isbn10: "" };
};

const main = async () => {
  const raw = JSON.parse(await readFile(DATA_PATH, "utf8"));
  const livres = Array.isArray(raw?.livres) ? raw.livres : [];

  let updated = 0;
  for (const b of livres) {
    const current = String(b.url_amazon || "").trim();
    if (current) continue;
    const title = String(b.titre || "").trim();
    const author = String(b.auteur || "").trim();
    if (!title) continue;
    try {
      const { url } = await resolveAmazonUrl({ title, author });
      if (!url) continue;
      b.url_amazon = url;
      updated += 1;
      console.log(`amazon ${title} -> ${url}`);
    } catch {
      // ignore
    }
  }

  await writeFile(DATA_PATH, JSON.stringify({ livres }, null, 2) + "\n", "utf8");
  console.log(`done: updated=${updated}`);
};

await main();
