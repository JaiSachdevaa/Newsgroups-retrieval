import numpy as np
import pytest
from sklearn.feature_extraction.text import HashingVectorizer

from app.bm25 import BM25Index
from app.corpus import assign_threads
from app.evaluation import evaluate
from app.query import parse_query
from app.searcher import Searcher
from app.text import embed_text, index_text, normalize_subject

VOCAB = {
    "comp.graphics": "render polygon shader texture gpu image pixel raster mesh opengl".split(),
    "rec.sport.hockey": "goalie playoff nhl puck season defenseman penalty rink skate overtime".split(),
    "sci.crypt": "encryption cipher clipper rsa keyspace plaintext hash cryptanalysis nonce entropy".split(),
}
COMMON = "the a of and to in is it for with this that on are".split()


class FakeEmbedder:
    def __init__(self):
        self.vectorizer = HashingVectorizer(n_features=512, norm="l2", alternate_sign=False)

    def load(self):
        return self

    def encode(self, texts, batch_size=64, show_progress=False):
        return self.vectorizer.transform(texts).toarray().astype(np.float32)


def make_docs():
    rng = np.random.default_rng(7)
    docs = []
    for group, words in VOCAB.items():
        for _ in range(14):
            subject = " ".join(str(w) for w in rng.choice(words, size=3, replace=False))
            for reply in range(int(rng.integers(1, 4))):
                body = " ".join(
                    [str(w) for w in rng.choice(words, size=15)]
                    + [str(w) for w in rng.choice(COMMON, size=10)]
                )
                shown = ("Re: " if reply else "") + subject
                doc_id = len(docs)
                docs.append(
                    {
                        "id": doc_id,
                        "group": group,
                        "number": 1000 + doc_id,
                        "subject": shown,
                        "norm_subject": normalize_subject(shown),
                        "author": f"User {doc_id % 5}",
                        "from_raw": f"user{doc_id % 5}@example.edu (User {doc_id % 5})",
                        "organization": "Example University",
                        "body": body,
                    }
                )
    return assign_threads(docs)


@pytest.fixture(scope="module")
def searcher():
    docs = make_docs()
    bm25 = BM25Index().fit([index_text(d) for d in docs])
    embedder = FakeEmbedder()
    embeddings = embedder.encode([embed_text(d) for d in docs])
    return Searcher(docs, bm25, embeddings, embedder)


@pytest.mark.parametrize("mode", ["bm25", "semantic", "hybrid"])
def test_modes_find_the_right_group(searcher, mode):
    out = searcher.search("goalie playoff puck", mode=mode, limit=5)
    assert out["results"]
    assert out["results"][0]["group"] == "rec.sport.hockey"
    assert out["results"][0]["relevance"] == 1.0


def test_hybrid_exposes_both_ranks(searcher):
    out = searcher.search("encryption cipher", mode="hybrid", limit=3)
    why = out["results"][0]["why"]
    assert why["bm25"] is not None and why["semantic"] is not None
    assert why["rrf_k"] == 60


def test_group_filter_prefix(searcher):
    out = searcher.search("render shader", mode="hybrid", group="comp", limit=20)
    assert out["results"]
    assert all(r["group"].startswith("comp") for r in out["results"])


def test_group_operator(searcher):
    out = searcher.search("group:sci.crypt cipher", mode="bm25", limit=20)
    assert out["results"]
    assert all(r["group"] == "sci.crypt" for r in out["results"])


def test_author_operator(searcher):
    out = searcher.search("from:user3 puck", mode="bm25", limit=20)
    assert out["results"]
    assert all(searcher.docs[r["id"]]["from_raw"].startswith("user3@") for r in out["results"])


def test_phrase_operator(searcher):
    doc = next(d for d in searcher.docs if d["group"] == "sci.crypt")
    words = doc["norm_subject"].split()
    phrase = " ".join(words[:2])
    out = searcher.search(f'"{phrase}"', mode="hybrid", limit=20)
    assert out["results"]
    for r in out["results"]:
        d = searcher.docs[r["id"]]
        assert phrase in f"{d['subject']} {d['body']}".lower()


def test_browse_without_query(searcher):
    out = searcher.search("", group="rec.sport.hockey", limit=10)
    assert out["total"] > 0
    assert all(r["group"] == "rec.sport.hockey" for r in out["results"])


def test_pagination_offsets(searcher):
    first = searcher.search("goalie", mode="bm25", limit=3, offset=0)
    second = searcher.search("goalie", mode="bm25", limit=3, offset=3)
    ids = {r["id"] for r in first["results"]} | {r["id"] for r in second["results"]}
    assert len(ids) == len(first["results"]) + len(second["results"])


def test_similar_excludes_own_thread(searcher):
    doc = searcher.docs[0]
    own = set(searcher.thread_members[doc["thread_id"]])
    out = searcher.similar(0, k=8)
    assert out
    assert not own & {r["id"] for r in out}


def test_thread_is_ordered(searcher):
    thread_id, members = next((t, m) for t, m in searcher.thread_members.items() if len(m) > 1)
    out = searcher.thread(members[-1])
    numbers = [p["number"] for p in out["posts"]]
    assert numbers == sorted(numbers)
    assert out["count"] == len(members)


def test_group_tree_counts(searcher):
    tree = searcher.group_tree()
    assert sum(node["count"] for node in tree) == len(searcher.docs)


def test_suggest_subjects_and_groups(searcher):
    subject = searcher.docs[0]["norm_subject"].split()[0]
    assert searcher.suggest(subject)
    groups = searcher.suggest("render group:sci")
    assert groups and all(g["type"] == "group" for g in groups)
    assert groups[0]["value"].startswith("render group:sci")


def test_parse_query_operators():
    parsed = parse_query('group:sci.space from:"john smith" "space shuttle" launch')
    assert parsed.groups == ["sci.space"]
    assert parsed.authors == ["john smith"]
    assert parsed.phrases == ["space shuttle"]
    assert parsed.text == "space shuttle launch"


def test_evaluation_metrics(searcher):
    report = evaluate(searcher, num_queries=40, depth=50)
    assert report["num_queries"] > 0
    for metrics in report["modes"].values():
        for key in ("p10", "map100", "ndcg10"):
            assert 0.0 <= metrics[key] <= 1.0
    assert report["modes"]["hybrid"]["p10"] > 0.5
    assert set(report["by_group"]) == set(VOCAB)
