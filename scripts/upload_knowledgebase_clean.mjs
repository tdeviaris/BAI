#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const inputDir = process.argv[2] || "knowledgebase_clean";
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(2);
}

if (!fs.existsSync(inputDir)) {
  console.error(`Folder not found: ${inputDir}`);
  console.error("Run: python3 scripts/prepare_knowledgebase.py");
  process.exit(2);
}

const mdFiles = walk(inputDir).filter((p) => p.toLowerCase().endsWith(".md"));
if (mdFiles.length === 0) {
  console.error(`No .md files found in: ${inputDir}`);
  process.exit(2);
}

const client = new OpenAI({ apiKey });
const vectorStoreName = process.env.OPENAI_VECTOR_STORE_NAME || `BAI knowledgebase (${new Date().toISOString()})`;

console.log(`Uploading ${mdFiles.length} files…`);
const fileIds = [];
for (const filePath of mdFiles) {
  const created = await client.files.create({
    file: fs.createReadStream(filePath),
    purpose: "assistants",
  });
  fileIds.push(created.id);
}

console.log("Creating vector store…");
const vectorStore = await client.vectorStores.create({ name: vectorStoreName });

console.log("Indexing files…");
const batch = await client.vectorStores.fileBatches.create(vectorStore.id, { file_ids: fileIds });

for (;;) {
  const current = await client.vectorStores.fileBatches.retrieve(vectorStore.id, batch.id);
  if (current.status === "completed") break;
  if (current.status === "failed") {
    console.error("Vector store indexing failed.");
    process.exit(1);
  }
  process.stdout.write(".");
  await sleep(2000);
}
process.stdout.write("\n");

console.log("Done.");
console.log(`OPENAI_VECTOR_STORE_ID=${vectorStore.id}`);

