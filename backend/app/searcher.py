import pickle
import re
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

from .bm25 import BM25Index
from .config import CANDIDATES, PHRASE_CANDIDATES, RERANK_TOP, RRF_K
from .embedder import Embedder, Reranker
from .query import parse_query
from .text import embed_text, make_snippet, strip_prefix, tokenize

SPACE_RE = re.compile(r"\s+")
BODY_LIMIT = 8000


class Searcher:
    def __init__(self, docs, bm25, embeddings, embedder, reranker=None):
        self.docs = docs
        self.bm25 = bm25
        self.embeddings = embeddings
        self.embedder = embedder
        self.reranker = reranker
        self.n = len(docs)
        self.group_names = sorted({d["group"] for d in docs})
        group_index = {name: i for i, name in enumerate(self.group_names)}
        self.group_ids = np.array([group_index[d["group"]] for d in docs], dtype=np.int32)
        self.numbers = np.array([d["number"] for d in docs], dtype=np.int64)
        self.author_text = [d["from_raw"].lower() for d in docs]
        self.thread_members = defaultdict(list)
        for d in docs:
            self.thread_members[d["thread_id"]].append(d["id"])
        for members in self.thread_members.values():
            members.sort(key=lambda i: docs[i]["number"])
        self.thread_sizes = np.array(
            [len(self.thread_members[d["thread_id"]]) for d in docs], dtype=np.int32
        )
        self.subject_index = self._build_subject_index()
        self._tree = None

    @classmethod
    def load(cls, index_dir, embed_model, rerank_model=None):
        index_dir = Path(index_dir)
        needed = ["corpus.pkl", "bm25.pkl", "embeddings.npy"]
        missing = [name for name in needed if not (index_dir / name).exists()]
        if missing:
            raise RuntimeError(
                f"Missing index files {missing} in {index_dir}. Run: python build_index.py"
            )
        with open(index_dir / "corpus.pkl", "rb") as handle:
            docs = pickle.load(handle)
        bm25 = BM25Index.load(index_dir / "bm25.pkl")
        embeddings = np.load(index_dir / "embeddings.npy")
        reranker = Reranker(rerank_model) if rerank_model else None
        return cls(docs, bm25, embeddings, Embedder(embed_model), reranker)

    def _build_subject_index(self):
        seen = {}
        for d in self.docs:
            key = d["norm_subject"]
            if key and key not in seen:
                seen[key] = (strip_prefix(d["subject"]), key, int(self.thread_sizes[d["id"]]))
        return sorted(seen.values(), key=lambda item: -item[2])

    def _group_mask(self, patterns):
        allowed = [
            i for i, name in enumerate(self.group_names) if any(name.startswith(p) for p in patterns)
        ]
        return np.isin(self.group_ids, allowed)

    def _mask(self, parsed, group):
        mask = np.ones(self.n, dtype=bool)
        if group:
            mask &= self._group_mask([group.lower()])
        if parsed.groups:
            mask &= self._group_mask(parsed.groups)
        if parsed.authors:
            mask &= np.fromiter(
                (all(a in text for a in parsed.authors) for text in self.author_text),
                dtype=bool,
                count=self.n,
            )
        return mask

    @staticmethod
    def _top(scores, mask, k):
        k = min(k, int(mask.sum()))
        if k <= 0:
            return np.array([], dtype=np.int64)
        masked = np.where(mask, scores, -np.inf)
        part = np.argpartition(-masked, k - 1)[:k]
        return part[np.argsort(-masked[part])]

    def _rank(self, text, mode, mask, pool):
        bm25_scores = None
        semantic_scores = None
        lex_ids = np.array([], dtype=np.int64)
        sem_ids = np.array([], dtype=np.int64)
        if mode in ("bm25", "hybrid"):
            bm25_scores = self.bm25.score(text)
            lex_ids = self._top(bm25_scores, mask & (bm25_scores > 0), pool)
        if mode in ("semantic", "hybrid"):
            semantic_scores = self.embeddings @ self.embedder.encode([text])[0]
            sem_ids = self._top(semantic_scores, mask, pool)
        lex_rank = {int(i): r + 1 for r, i in enumerate(lex_ids)}
        sem_rank = {int(i): r + 1 for r, i in enumerate(sem_ids)}
        if mode == "bm25":
            ordered = [(int(i), float(bm25_scores[i])) for i in lex_ids]
        elif mode == "semantic":
            ordered = [(int(i), float(semantic_scores[i])) for i in sem_ids]
        else:
            fused = defaultdict(float)
            for doc_id, rank in lex_rank.items():
                fused[doc_id] += 1.0 / (RRF_K + rank)
            for doc_id, rank in sem_rank.items():
                fused[doc_id] += 1.0 / (RRF_K + rank)
            ordered = sorted(fused.items(), key=lambda item: -item[1])
        return ordered, lex_rank, sem_rank, bm25_scores, semantic_scores

    def ranked_ids(self, text, mode, k, exclude=()):
        mask = np.ones(self.n, dtype=bool)
        if len(exclude) > 0:
            mask[list(exclude)] = False
        ordered = self._rank(text, mode, mask, max(CANDIDATES, k))[0]
        return [i for i, _ in ordered[:k]]

    def _contains_all(self, doc_id, phrases):
        d = self.docs[doc_id]
        haystack = SPACE_RE.sub(" ", f"{d['subject']} {d['body']}").lower()
        return all(p in haystack for p in phrases)

    def _rerank(self, text, ordered):
        head = ordered[:RERANK_TOP]
        pairs = [(text, embed_text(self.docs[i])) for i, _ in head]
        scores = self.reranker.score(pairs)
        reranked = [(i, float(s)) for (i, _), s in zip(head, scores)]
        return sorted(reranked, key=lambda item: -item[1])

    def _why(self, doc_id, lex_rank, sem_rank, bm25_scores, semantic_scores):
        return {
            "bm25": round(float(bm25_scores[doc_id]), 4) if bm25_scores is not None else None,
            "bm25_rank": lex_rank.get(doc_id),
            "semantic": round(float(semantic_scores[doc_id]), 4) if semantic_scores is not None else None,
            "semantic_rank": sem_rank.get(doc_id),
            "rrf_k": RRF_K,
        }

    def _result(self, doc_id, score, relevance, terms, why):
        d = self.docs[doc_id]
        return {
            "id": doc_id,
            "group": d["group"],
            "number": d["number"],
            "subject": d["subject"],
            "author": d["author"],
            "organization": d["organization"],
            "snippet": make_snippet(d["body"], terms),
            "score": round(score, 4),
            "relevance": None if relevance is None else round(relevance, 4),
            "thread_id": d["thread_id"],
            "thread_size": int(self.thread_sizes[doc_id]),
            "why": why,
        }

    def _terms(self, parsed):
        return list(dict.fromkeys(tokenize(parsed.text)))

    def search(self, raw_query, mode="hybrid", group=None, limit=20, offset=0, rerank=False):
        parsed = parse_query(raw_query)
        mask = self._mask(parsed, group)
        filters = {
            "group": group or "",
            "groups": parsed.groups,
            "authors": parsed.authors,
            "phrases": parsed.phrases,
        }
        if not parsed.text:
            return self._browse(mask, limit, offset, filters)
        terms = self._terms(parsed)
        pool = PHRASE_CANDIDATES if parsed.phrases else CANDIDATES
        ordered, lex_rank, sem_rank, bm25_scores, semantic_scores = self._rank(
            parsed.text, mode, mask, pool
        )
        capped = len(ordered) >= pool
        if parsed.phrases:
            ordered = [(i, s) for i, s in ordered if self._contains_all(i, parsed.phrases)]
        reranked = False
        if rerank and self.reranker is not None and ordered:
            ordered = self._rerank(parsed.text, ordered)
            reranked = True
            capped = False
        scores = [s for _, s in ordered]
        top = max(scores) if scores else 1.0
        low = min(scores) if reranked and scores else 0.0
        results = []
        for doc_id, score in ordered[offset : offset + limit]:
            span = top - low
            relevance = (score - low) / span if span > 0 else 1.0
            relevance = min(max(relevance, 0.0), 1.0)
            why = self._why(doc_id, lex_rank, sem_rank, bm25_scores, semantic_scores)
            results.append(self._result(doc_id, score, relevance, terms, why))
        return {
            "total": len(ordered),
            "capped": capped,
            "reranked": reranked,
            "terms": terms,
            "filters": filters,
            "results": results,
        }

    def _browse(self, mask, limit, offset, filters):
        idx = np.nonzero(mask)[0]
        order = np.lexsort((self.numbers[idx], -self.thread_sizes[idx]))
        ids = idx[order]
        page = ids[offset : offset + limit]
        results = [self._result(int(i), 0.0, None, [], None) for i in page]
        return {
            "total": int(len(ids)),
            "capped": False,
            "reranked": False,
            "terms": [],
            "filters": filters,
            "results": results,
        }

    def similar(self, doc_id, k=10):
        sims = self.embeddings @ self.embeddings[doc_id]
        own_thread = self.thread_members[self.docs[doc_id]["thread_id"]]
        sims[own_thread] = -np.inf
        top = self._top(sims, np.isfinite(sims), k)
        results = []
        for i in top:
            cosine = float(sims[i])
            why = {"semantic": round(cosine, 4), "semantic_rank": None, "bm25": None, "bm25_rank": None, "rrf_k": RRF_K}
            results.append(self._result(int(i), cosine, max(cosine, 0.0), [], why))
        return results

    def _post(self, doc_id):
        d = self.docs[doc_id]
        body = d["body"]
        return {
            "id": doc_id,
            "number": d["number"],
            "group": d["group"],
            "subject": d["subject"],
            "author": d["author"],
            "organization": d["organization"],
            "body": body[:BODY_LIMIT],
            "truncated": len(body) > BODY_LIMIT,
        }

    def thread(self, doc_id):
        thread_id = self.docs[doc_id]["thread_id"]
        members = self.thread_members[thread_id]
        shown = members[:100]
        if doc_id not in shown:
            shown = shown[:99] + [doc_id]
        first = self.docs[members[0]]
        return {
            "thread_id": thread_id,
            "subject": strip_prefix(first["subject"]),
            "group": first["group"],
            "count": len(members),
            "posts": [self._post(i) for i in shown],
        }

    def group_tree(self):
        if self._tree is not None:
            return self._tree
        counts = Counter(d["group"] for d in self.docs)
        root = {}
        for group, count in counts.items():
            parts = group.split(".")
            level = root
            for depth, part in enumerate(parts):
                path = ".".join(parts[: depth + 1])
                entry = level.setdefault(
                    part, {"name": part, "path": path, "count": 0, "children": {}}
                )
                entry["count"] += count
                level = entry["children"]

        def to_list(nodes):
            return [
                {
                    "name": node["name"],
                    "path": node["path"],
                    "count": node["count"],
                    "children": to_list(node["children"]),
                }
                for node in sorted(nodes.values(), key=lambda n: n["name"])
            ]

        self._tree = to_list(root)
        return self._tree

    def suggest(self, query, limit=8):
        query = query or ""
        group_match = re.search(r"(?:^|\s)group:(\S*)$", query, re.IGNORECASE)
        if group_match:
            prefix = group_match.group(1).lower()
            head = query[: group_match.start(1) - len("group:")]
            return [
                {"type": "group", "label": name, "value": f"{head}group:{name} "}
                for name in self.group_names
                if name.startswith(prefix)
            ][:limit]
        needle = query.strip().lower()
        if len(needle) < 2:
            return []
        starts = []
        contains = []
        for display, key, _ in self.subject_index:
            if key.startswith(needle):
                starts.append(display)
            elif needle in key:
                contains.append(display)
            if len(starts) >= limit:
                break
        picked = (starts + contains)[:limit]
        return [{"type": "subject", "label": s, "value": s} for s in picked]
