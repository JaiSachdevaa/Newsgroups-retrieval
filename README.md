# Newsgroups Retrieval

A search engine over the 20 Newsgroups archive (about 18,800 Usenet posts). It combines keyword search, semantic search and a fused hybrid ranking, with a three pane reader, a topic map, corpus analytics and a built in evaluation report.

## Architecture

```
20 Newsgroups -> parse headers -> BM25 index ----\
                 build threads -> MiniLM vectors --> RRF fusion -> optional cross-encoder rerank
                                                          |
                                                      FastAPI  ->  React (Vite, Tailwind, Recharts)
```

| Layer | What it does |
|---|---|
| Parsing | Splits headers from bodies, drops footers and quoted replies, keeps From, Subject and Organization as metadata |
| Threads | Groups posts by normalized subject inside a newsgroup (Re:, Fwd: stripped) |
| Keyword | BM25 implemented on a sparse matrix, subject weighted double |
| Semantic | all-MiniLM-L6-v2 embeddings, cosine similarity |
| Hybrid | Reciprocal Rank Fusion (k = 60) over the top 200 of each ranker |
| Rerank | Optional cross-encoder over the top 50 |
| Operators | `group:sci` (prefix match), `from:name`, `"exact phrase"` |
| Evaluation | Subject line of a random post as the query, same newsgroup as relevance, own thread excluded |

## Run it

Backend (Python 3.10 or newer):

```
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python build_index.py
uvicorn app.main:app --port 8000
```

`build_index.py` downloads the dataset, builds the indexes, projects the topic map, computes statistics and runs the evaluation. Embedding about 18,800 posts takes a few minutes on a CPU. Run it once.

Frontend:

```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies `/api` to port 8000.

Docker:

```
docker compose run --rm backend python build_index.py
docker compose up --build
```

Open http://localhost:8080.

## Tests

```
cd backend
pip install -r requirements-dev.txt
pytest
```

The tests use a small synthetic corpus and a hashing embedder, so they run in seconds without downloading anything.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/search?q=&mode=bm25\|semantic\|hybrid&group=&limit=&offset=&rerank=` | Ranked results with snippets, highlight terms and score breakdown |
| `GET /api/suggest?q=` | Subject and group autocomplete |
| `GET /api/groups` | Newsgroup hierarchy with counts |
| `GET /api/thread/{id}` | Thread for a post |
| `GET /api/similar/{id}` | Nearest posts by embedding |
| `GET /api/topics` | 2D projection of a 3,000 post sample |
| `GET /api/stats` | Corpus statistics |
| `GET /api/eval` | P@10, MAP@100, nDCG@10 and latency per mode |

## Frontend

- Search page with three panes: newsgroup tree, results, and a reader with Thread, Similar posts and Why this ranked tabs
- Keyboard: `/` focuses search, `j` and `k` move through results, Escape leaves the input
- Topic map, Analytics and Evaluation pages
- Light and dark theme

## Notes

- Threads are rebuilt from subjects because the dataset keeps no Message-ID or References headers.
- The dataset has no dates, so there is no date filter.
- Relevance in the evaluation is the newsgroup label, which is a proxy. Treat the numbers as a comparison between modes, not as absolute quality.
- The reranker and the embedding model download from Hugging Face the first time they are used.
