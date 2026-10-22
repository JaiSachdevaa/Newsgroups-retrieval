from collections import Counter

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

from .text import strip_prefix

LENGTH_EDGES = [0, 50, 100, 200, 400, 800, 1600, 1601]
LENGTH_LABELS = ["0-50", "50-100", "100-200", "200-400", "400-800", "800-1600", "1600+"]


def project_2d(vectors):
    try:
        import umap

        reducer = umap.UMAP(
            n_components=2, n_neighbors=15, min_dist=0.1, metric="cosine", random_state=42
        )
        return reducer.fit_transform(vectors), "UMAP"
    except ImportError:
        from sklearn.decomposition import PCA

        return PCA(n_components=2, random_state=42).fit_transform(vectors), "PCA"


def compute_topic_map(docs, embeddings, sample=3000, seed=42):
    rng = np.random.default_rng(seed)
    size = min(sample, len(docs))
    chosen = np.sort(rng.choice(len(docs), size=size, replace=False))
    coords, method = project_2d(embeddings[chosen])
    low = coords.min(axis=0)
    high = coords.max(axis=0)
    scaled = (coords - low) / np.maximum(high - low, 1e-9)
    points = [
        {
            "id": int(doc_id),
            "x": round(float(x), 4),
            "y": round(float(y), 4),
            "group": docs[int(doc_id)]["group"],
            "subject": strip_prefix(docs[int(doc_id)]["subject"]),
        }
        for doc_id, (x, y) in zip(chosen, scaled)
    ]
    return {"method": method, "sampled": size, "total": len(docs), "points": points}


def compute_stats(docs, searcher):
    group_names = searcher.group_names
    by_group = {name: [] for name in group_names}
    word_counts = []
    for d in docs:
        by_group[d["group"]].append(d)
        word_counts.append(len(d["body"].split()))

    vectorizer = TfidfVectorizer(
        stop_words="english",
        sublinear_tf=True,
        max_df=0.4,
        token_pattern=r"(?u)\b[a-zA-Z]{3,}\b",
        max_features=50000,
    )
    matrix = vectorizer.fit_transform(
        [" ".join(d["body"] for d in by_group[name]) for name in group_names]
    )
    vocab = np.array(vectorizer.get_feature_names_out())

    groups = []
    for row, name in enumerate(group_names):
        scores = matrix[row].toarray().ravel()
        top = np.argsort(-scores)[:8]
        counts = [len(d["body"].split()) for d in by_group[name]]
        groups.append(
            {
                "name": name,
                "count": len(by_group[name]),
                "avg_words": round(float(np.mean(counts)), 1) if counts else 0.0,
                "top_terms": [str(vocab[i]) for i in top if scores[i] > 0],
            }
        )

    author_counts = Counter()
    author_names = {}
    for d in docs:
        key = d["from_raw"].lower()
        if not key:
            continue
        author_counts[key] += 1
        author_names.setdefault(key, d["author"])
    histogram, _ = np.histogram(np.minimum(word_counts, 1600), bins=LENGTH_EDGES)

    return {
        "total_posts": len(docs),
        "total_threads": len(searcher.thread_members),
        "total_authors": len(author_counts),
        "avg_words": round(float(np.mean(word_counts)), 1),
        "groups": groups,
        "top_authors": [
            {"name": author_names[key], "count": count}
            for key, count in author_counts.most_common(10)
        ],
        "length_histogram": [
            {"bin": label, "count": int(count)} for label, count in zip(LENGTH_LABELS, histogram)
        ],
    }
