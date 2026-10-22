import json
import pickle
import time

import numpy as np

from app.analysis import compute_stats, compute_topic_map
from app.bm25 import BM25Index
from app.config import EMBED_MODEL, INDEX_DIR
from app.corpus import load_corpus
from app.embedder import Embedder
from app.evaluation import evaluate
from app.searcher import Searcher
from app.text import embed_text, index_text


def step(message):
    print(f"[{time.strftime('%H:%M:%S')}] {message}", flush=True)


def write_json(name, payload):
    with open(INDEX_DIR / name, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False)


def main():
    INDEX_DIR.mkdir(parents=True, exist_ok=True)

    step("Loading the 20 Newsgroups corpus")
    docs = load_corpus()
    step(f"Parsed {len(docs)} posts")
    with open(INDEX_DIR / "corpus.pkl", "wb") as handle:
        pickle.dump(docs, handle, protocol=pickle.HIGHEST_PROTOCOL)

    step("Building the BM25 index")
    bm25 = BM25Index().fit([index_text(d) for d in docs])
    bm25.save(INDEX_DIR / "bm25.pkl")

    step(f"Embedding posts with {EMBED_MODEL} (several minutes on CPU)")
    embedder = Embedder(EMBED_MODEL)
    embeddings = embedder.encode([embed_text(d) for d in docs], show_progress=True)
    np.save(INDEX_DIR / "embeddings.npy", embeddings)

    searcher = Searcher(docs, bm25, embeddings, embedder)

    step("Projecting the topic map")
    write_json("topics.json", compute_topic_map(docs, embeddings))

    step("Computing corpus statistics")
    write_json("stats.json", compute_stats(docs, searcher))

    step("Evaluating keyword, semantic and hybrid retrieval")
    report = evaluate(searcher)
    write_json("eval.json", report)
    for mode, metrics in report["modes"].items():
        step(f"{mode}: {metrics}")

    step("Index ready. Start the API with: uvicorn app.main:app --port 8000")


if __name__ == "__main__":
    main()
