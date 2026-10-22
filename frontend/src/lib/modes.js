export const MODES = [
  {
    id: "bm25",
    label: "Keyword",
    color: "#6b8afd",
    blurb: "BM25 over the subject and body. Exact words and rare terms matter most.",
  },
  {
    id: "semantic",
    label: "Semantic",
    color: "#2dd4bf",
    blurb: "MiniLM sentence embeddings with cosine similarity. Meaning matters, wording does not.",
  },
  {
    id: "hybrid",
    label: "Hybrid",
    color: "#f5a524",
    blurb: "Keyword and Semantic rankings merged with Reciprocal Rank Fusion.",
  },
];

export const MODE_BY_ID = Object.fromEntries(MODES.map((mode) => [mode.id, mode]));
