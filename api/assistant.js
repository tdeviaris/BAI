import OpenAI from "openai";

function asJson(req) {
  if (!req?.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function extractFileIdsFromResponse(response) {
  const ids = new Set();
  for (const item of response?.output ?? []) {
    if (item?.type === "message") {
      for (const content of item?.content ?? []) {
        const annotations = content?.annotations ?? [];
        for (const ann of annotations) {
          if (ann?.type === "file_citation" && ann?.file_id) ids.add(ann.file_id);
          if (ann?.file_citation?.file_id) ids.add(ann.file_citation.file_id);
        }
      }
    }
    if (item?.type === "file_search_call") {
      for (const r of item?.results ?? []) {
        if (r?.file_id) ids.add(r.file_id);
      }
    }
  }
  return [...ids];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  if (!vectorStoreId) return res.status(500).json({ error: "Missing OPENAI_VECTOR_STORE_ID" });

  const payload = asJson(req);
  const message = String(payload?.message ?? "").trim();
  const history = Array.isArray(payload?.history) ? payload.history : [];

  if (!message) return res.status(400).json({ error: "Missing message" });

  res.setHeader("Cache-Control", "no-store");
  const client = new OpenAI({ apiKey, timeout: 30_000 });

  const input = [];
  for (const h of history.slice(-12)) {
    const role = h?.role === "assistant" ? "assistant" : "user";
    const content = String(h?.content ?? "").trim();
    if (content) input.push({ role, content });
  }

  try {
    const startedAt = Date.now();
    const overallAbort = new AbortController();
    const overallTimer = setTimeout(() => overallAbort.abort(), 13_500);

    try {
      const search = await client.vectorStores.search(
        vectorStoreId,
        {
          query: message,
          max_num_results: 4,
          rewrite_query: false,
          ranking_options: { score_threshold: 0.15 },
        },
        { signal: overallAbort.signal, timeout: 4_000 }
      );

      const hits = Array.isArray(search?.data) ? search.data : [];
      const sources = hits.slice(0, 4).map((h) => ({
        file_id: h.file_id,
        filename: h.filename,
        score: h.score,
      }));

      const context = hits
        .slice(0, 4)
        .map((h, idx) => {
          const chunks = (h.content || [])
            .map((c) => String(c?.text || "").trim())
            .filter(Boolean)
            .slice(0, 2)
            .join("\n\n");
          const snippet = chunks.length > 1200 ? `${chunks.slice(0, 1200)}…` : chunks;
          return `[${idx + 1}] ${h.filename} (score ${Number(h.score).toFixed(3)})\n${snippet}`;
        })
        .filter(Boolean)
        .join("\n\n---\n\n");

      const response = await client.responses.create(
        {
          model,
          instructions:
            "Tu es l’assistant IA de “The Entrepreneur Whisperer”. Réponds en français, de façon actionnable, en te basant d’abord sur les extraits fournis (issus de la base de connaissance). Si l’info n’est pas dans les extraits, dis-le clairement et propose une démarche. Termine par une courte liste de points clés.",
          input: [
            { role: "developer", content: `Extraits (base de connaissance)\n\n${context || "(aucun extrait pertinent trouvé)"}` },
            ...input,
            { role: "user", content: message },
          ],
          max_output_tokens: 320,
        },
        { signal: overallAbort.signal, timeout: 10_000 }
      );

      const answer = response.output_text || "";
      console.log("assistant.ok", { ms: Date.now() - startedAt, sources: sources.length });

      return res.status(200).json({ answer, sources });
    } finally {
      clearTimeout(overallTimer);
    }
  } catch (err) {
    if (err?.name === "AbortError") {
      return res.status(504).json({ error: "Timeout. Réessaie dans quelques secondes." });
    }
    const message = err?.message || "OpenAI request failed";
    const status = err?.status || 500;
    return res.status(status).json({ error: message });
  }
}
