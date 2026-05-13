const WorkspaceEmbedding = require("./WorkspaceEmbedding");

function tokenize(text) {
  return String(text || "").toLowerCase().match(/[a-z0-9]{3,}/g) || [];
}

function hashToken(token, dimensions) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % dimensions;
}

function vectorize(text, dimensions = 64) {
  const vector = Array(dimensions).fill(0);
  tokenize(text).forEach((token) => {
    vector[hashToken(token, dimensions)] += 1;
  });
  const magnitude = Math.sqrt(vector.reduce((total, value) => total + value * value, 0)) || 1;
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

function cosineSimilarity(a = [], b = []) {
  const length = Math.min(a.length, b.length);
  if (!length) return 0;
  let dot = 0;
  for (let index = 0; index < length; index += 1) dot += a[index] * b[index];
  return dot;
}

async function upsertWorkspaceEmbedding({ owner, sourceType, sourceId, title, text, route = "" }) {
  const cleanText = String(text || "").trim();
  if (!owner || !sourceType || !sourceId || !cleanText) return null;

  return WorkspaceEmbedding.findOneAndUpdate(
    { owner, sourceType, sourceId: String(sourceId) },
    {
      owner,
      sourceType,
      sourceId: String(sourceId),
      title: String(title || "").trim(),
      text: cleanText.slice(0, 20_000),
      route,
      tokens: tokenize(`${title || ""} ${cleanText}`).slice(0, 1000),
      vector: vectorize(`${title || ""} ${cleanText}`),
    },
    { upsert: true, new: true }
  );
}

async function retrieveWorkspaceEmbeddings({ owner, query, limit = 5 }) {
  const embeddings = await WorkspaceEmbedding.find({ owner }).sort({ updatedAt: -1 }).limit(300);
  const queryVector = vectorize(query);
  return embeddings
    .map((embedding) => ({
      embedding,
      score: cosineSimilarity(queryVector, embedding.vector?.length ? embedding.vector : vectorize(`${embedding.title} ${embedding.text}`)),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ embedding, score }) => ({
      type: embedding.sourceType,
      id: embedding.sourceId,
      title: embedding.title,
      text: embedding.text,
      route: embedding.route,
      score: Number(score.toFixed(4)),
    }));
}

module.exports = {
  retrieveWorkspaceEmbeddings,
  upsertWorkspaceEmbedding,
};
