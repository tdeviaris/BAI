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
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  if (!vectorStoreId) return res.status(500).json({ error: "Missing OPENAI_VECTOR_STORE_ID" });

  const payload = asJson(req);
  const message = String(payload?.message ?? "").trim();
  const history = Array.isArray(payload?.history) ? payload.history : [];

  if (!message) return res.status(400).json({ error: "Missing message" });

  const client = new OpenAI({ apiKey });

  const input = [];
  for (const h of history.slice(-12)) {
    const role = h?.role === "assistant" ? "assistant" : "user";
    const content = String(h?.content ?? "").trim();
    if (content) input.push({ role, content });
  }
  input.push({ role: "user", content: message });

  try {
    const response = await client.responses.create({
      model,
      instructions:
        "Tu es l’assistant IA de “The Entrepreneur Whisperer”. Réponds en français, de façon actionnable, et base-toi en priorité sur les documents de la base de connaissance (outil file_search). Si l’info est absente, dis-le clairement et propose une démarche. Termine par une courte liste de points clés.",
      tools: [{ type: "file_search" }],
      tool_choice: "auto",
      input,
      max_output_tokens: 800,
      // Force the tool to search in our vector store.
      // (The SDK supports passing vector store ids at request time.)
      tool_resources: {
        file_search: {
          vector_store_ids: [vectorStoreId],
        },
      },
    });

    const answer = response.output_text || "";
    const fileIds = extractFileIdsFromResponse(response);

    const sources = [];
    for (const fileId of fileIds.slice(0, 12)) {
      try {
        const file = await client.files.retrieve(fileId);
        sources.push({ file_id: fileId, filename: file?.filename || fileId });
      } catch {
        sources.push({ file_id: fileId, filename: fileId });
      }
    }

    return res.status(200).json({ answer, sources });
  } catch (err) {
    const message = err?.message || "OpenAI request failed";
    const status = err?.status || 500;
    return res.status(status).json({ error: message });
  }
}

