import json
import time
from contextlib import asynccontextmanager
from functools import lru_cache
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS, EMBED_MODEL, INDEX_DIR, RERANK_MODEL
from .searcher import Searcher

state = {}


def read_json(name):
    path = INDEX_DIR / name
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


@asynccontextmanager
async def lifespan(app):
    searcher = Searcher.load(INDEX_DIR, EMBED_MODEL, RERANK_MODEL)
    searcher.embedder.load()
    state["searcher"] = searcher
    state["topics"] = read_json("topics.json")
    state["stats"] = read_json("stats.json")
    state["eval"] = read_json("eval.json")
    run_search.cache_clear()
    run_suggest.cache_clear()
    yield
    state.clear()


app = FastAPI(title="Newsgroups Retrieval API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["GET"], allow_headers=["*"]
)


@lru_cache(maxsize=512)
def run_search(q, mode, group, limit, offset, rerank):
    return state["searcher"].search(
        q, mode=mode, group=group or None, limit=limit, offset=offset, rerank=rerank
    )


@lru_cache(maxsize=1024)
def run_suggest(q):
    return state["searcher"].suggest(q)


def require_post(doc_id):
    if not 0 <= doc_id < state["searcher"].n:
        raise HTTPException(status_code=404, detail="Post not found")


def require_artifact(name):
    payload = state.get(name)
    if payload is None:
        raise HTTPException(
            status_code=404, detail="Not built yet. Run: python build_index.py"
        )
    return payload


@app.get("/api/health")
def health():
    searcher = state["searcher"]
    return {
        "status": "ok",
        "posts": searcher.n,
        "groups": len(searcher.group_names),
        "threads": len(searcher.thread_members),
    }


@app.get("/api/search")
def search(
    q: str = "",
    mode: Literal["bm25", "semantic", "hybrid"] = "hybrid",
    group: str = "",
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    rerank: bool = False,
):
    started = time.perf_counter()
    payload = run_search(q.strip(), mode, group.strip(), limit, offset, rerank)
    took = round((time.perf_counter() - started) * 1000, 1)
    return {"query": q, "mode": mode, "took_ms": took, **payload}


@app.get("/api/suggest")
def suggest(q: str = ""):
    return {"suggestions": run_suggest(q)}


@app.get("/api/groups")
def groups():
    return {"tree": state["searcher"].group_tree()}


@app.get("/api/thread/{doc_id}")
def thread(doc_id: int):
    require_post(doc_id)
    return state["searcher"].thread(doc_id)


@app.get("/api/similar/{doc_id}")
def similar(doc_id: int, k: int = Query(10, ge=1, le=30)):
    require_post(doc_id)
    return {"results": state["searcher"].similar(doc_id, k)}


@app.get("/api/topics")
def topics():
    return require_artifact("topics")


@app.get("/api/stats")
def stats():
    return require_artifact("stats")


@app.get("/api/eval")
def evaluation():
    return require_artifact("eval")
