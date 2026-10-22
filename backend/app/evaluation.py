import math
import time
from collections import Counter, defaultdict

import numpy as np

from .text import tokenize

MODES = ("bm25", "semantic", "hybrid")


def dcg(relevances):
    return sum(rel / math.log2(rank + 2) for rank, rel in enumerate(relevances))


def evaluate(searcher, num_queries=300, depth=100, seed=42):
    rng = np.random.default_rng(seed)
    eligible = [d["id"] for d in searcher.docs if len(tokenize(d["norm_subject"])) >= 2]
    size = min(num_queries, len(eligible))
    chosen = [int(i) for i in rng.choice(eligible, size=size, replace=False)]
    group_sizes = Counter(d["group"] for d in searcher.docs)

    p10_all = {m: [] for m in MODES}
    ap_all = {m: [] for m in MODES}
    ndcg_all = {m: [] for m in MODES}
    latency = {m: [] for m in MODES}
    p10_by_group = {m: defaultdict(list) for m in MODES}
    evaluated = 0

    for doc_id in chosen:
        doc = searcher.docs[doc_id]
        exclude = set(searcher.thread_members[doc["thread_id"]])
        relevant_total = group_sizes[doc["group"]] - len(exclude)
        if relevant_total <= 0:
            continue
        evaluated += 1
        for mode in MODES:
            started = time.perf_counter()
            ranked = searcher.ranked_ids(doc["norm_subject"], mode, depth, exclude)
            latency[mode].append((time.perf_counter() - started) * 1000.0)
            rels = [1 if searcher.docs[j]["group"] == doc["group"] else 0 for j in ranked]
            p10 = sum(rels[:10]) / 10.0
            hits = 0
            precision_sum = 0.0
            for rank, rel in enumerate(rels, start=1):
                if rel:
                    hits += 1
                    precision_sum += hits / rank
            average_precision = precision_sum / min(relevant_total, depth)
            ideal = dcg([1] * min(relevant_total, 10))
            ndcg = dcg(rels[:10]) / ideal if ideal > 0 else 0.0
            p10_all[mode].append(p10)
            ap_all[mode].append(average_precision)
            ndcg_all[mode].append(ndcg)
            p10_by_group[mode][doc["group"]].append(p10)

    def mean(values):
        return round(float(np.mean(values)), 4) if values else 0.0

    modes = {
        mode: {
            "p10": mean(p10_all[mode]),
            "map100": mean(ap_all[mode]),
            "ndcg10": mean(ndcg_all[mode]),
            "latency_ms": round(float(np.mean(latency[mode])), 2) if latency[mode] else 0.0,
        }
        for mode in MODES
    }
    by_group = {
        group: {mode: mean(p10_by_group[mode].get(group, [])) for mode in MODES}
        for group in searcher.group_names
    }
    return {
        "num_queries": evaluated,
        "depth": depth,
        "protocol": (
            "Each query is the subject line of a randomly sampled post. A result counts as relevant "
            "when it is in the same newsgroup as the query post. Posts from the query's own thread "
            "are removed from the ranking and from the relevant set."
        ),
        "modes": modes,
        "by_group": by_group,
    }
