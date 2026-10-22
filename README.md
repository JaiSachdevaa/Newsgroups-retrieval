# Newsgroups Retrieval

A search engine over the 20 Newsgroups archive (about 18,800 Usenet posts). It combines keyword search, semantic search and a fused hybrid ranking, and ships with a three pane reader, a topic map, corpus analytics and a built in evaluation report.

**Stack:** Python, FastAPI, BM25, sentence-transformers (MiniLM), React, Vite, Tailwind, Recharts, Docker

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Docker](#docker)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Evaluation](#evaluation)
- [Testing](#testing)
- [Design Notes and Limitations](#design-notes-and-limitations)
- [Author](#author)

## Features

- **Three retrieval modes:** BM25 keyword search, semantic search with MiniLM embeddings, and a hybrid mode that fuses both with Reciprocal Rank Fusion
- **Optional cross-encoder reranking** of the top 50 results for higher precision
- **Search operators:** `group:sci` (prefix match), `from:name` and `"exact phrase"`
- **Explainable ranking:** a "Why this ranked" tab shows the score breakdown and highlighted terms for each result
- **Three pane reader:** newsgroup tree, ranked results, and a reader with Thread, Similar posts and Why this ranked tabs
- **Thread reconstruction** from subject lines, with `Re:` and `Fwd:` stripped
- **Topic map:** 2D projection of a 3,000 post sample
- **Corpus analytics** and a **built in evaluation report** (P@10, MAP@100, nDCG@10 and latency per mode)
- **Keyboard navigation** and light and dark themes

## Screenshots

Add screenshots here once captured, for example:

```
docs/search.png
docs/topic-map.png
docs/evaluation.png
```

## Architecture

```
20 Newsgroups -> parse headers -> BM25 index ----\
                 build threads -> MiniLM vectors --> RRF fusion -> optional cross-encoder rerank
                                                          |
                                                      FastAPI  ->  React (Vite, Tailwind, Recharts)
```

| Layer | What it does |
| --- | --- |
| Parsing | Splits headers from bodies, drops footers and quoted replies, keeps From, Subject and Organization as metadata |
| Threads | Groups posts by normalized subject inside a newsgroup (`Re:` and `Fwd:` stripped) |
| Keyword | BM25 implemented on a sparse matrix, subject weighted double |
| Semantic | `all-MiniLM-L6-v2` embeddings, cosine similarity |
| Hybrid | Reciprocal Rank Fusion (k = 60) over the top 200 of each ranker |
| Rerank | Optional cross-encoder over the top 50 |
| Operators | `group:sci` (prefix match), `from:name`, `"exact phrase"` |
| Evaluation | Subject line of a random post as the query, same newsgroup as relevance, own thread excluded |

## Quick Start

### Prerequisites

- Python 3.10 or newer
- Node.js and npm
- Internet access on first run to download the dataset and models

### 1. Backend

```
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python build_index.py
uvicorn app.main:app --port 8000
```

On Windows, activate the environment with `.venv\Scripts\activate` instead of the `source` line.

`build_index.py` downloads the dataset, builds the indexes, projects the topic map, computes statistics and runs the evaluation. Embedding about 18,800 posts takes a few minutes on a CPU. Run it once.

### 2. Frontend

```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies `/api` to port 8000.

## Docker

```
docker compose run --rm backend python build_index.py
docker compose up --build
```

Open http://localhost:8080.

## Usage

### Search operators

| Operator | Example | Meaning |
| --- | --- | --- |
| `group:` | `group:sci encryption` | Restrict to newsgroups matching the prefix |
| `from:` | `from:smith orbit` | Restrict to a sender |
| `"..."` | `"space shuttle"` | Require an exact phrase |

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `/` | Focus the search box |
| `j` / `k` | Move down and up through results |
| `Esc` | Leave the search input |

### Pages

- **Search:** newsgroup tree, results and reader
- **Topic map:** 2D projection of a sample of posts
- **Analytics:** corpus statistics
- **Evaluation:** metrics and latency for each retrieval mode

## API Reference

| Endpoint | Purpose |
| --- | --- |
| `GET /api/search?q=&mode=bm25\|semantic\|hybrid&group=&limit=&offset=&rerank=` | Ranked results with snippets, highlight terms and score breakdown |
| `GET /api/suggest?q=` | Subject and group autocomplete |
| `GET /api/groups` | Newsgroup hierarchy with counts |
| `GET /api/thread/{id}` | Thread for a post |
| `GET /api/similar/{id}` | Nearest posts by embedding |
| `GET /api/topics` | 2D projection of a 3,000 post sample |
| `GET /api/stats` | Corpus statistics |
| `GET /api/eval` | P@10, MAP@100, nDCG@10 and latency per mode |

Example:

```
curl "http://localhost:8000/api/search?q=graphics+card&mode=hybrid&limit=10"
```

## Evaluation

The evaluation runs automatically during `build_index.py` and is served at `/api/eval` and on the Evaluation page.

- **Query:** the subject line of a random post
- **Relevance:** a result is relevant if it is in the same newsgroup as the query post
- **Exclusion:** the query post's own thread is removed from the results
- **Metrics:** P@10, MAP@100 and nDCG@10, plus latency, reported for each mode

Relevance is based on the newsgroup label, which is only a proxy for true relevance. Treat the numbers as a comparison between modes, not as absolute quality.

## Testing

```
cd backend
pip install -r requirements-dev.txt
pytest
```

The tests use a small synthetic corpus and a hashing embedder, so they run in seconds without downloading anything.

## Design Notes and Limitations

- Threads are rebuilt from subjects because the dataset keeps no Message-ID or References headers.
- The dataset has no dates, so there is no date filter.
- The reranker and the embedding model download from Hugging Face the first time they are used, so the first rerank request is slower.
- Hybrid ranking uses Reciprocal Rank Fusion, which combines rankings by position and so avoids having to normalize BM25 and cosine scores onto one scale.

## Author

Jai Sachdeva
GitHub: [JaiSachdevaa](https://github.com/JaiSachdevaa)