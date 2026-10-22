import pickle

import numpy as np
from scipy.sparse import csc_matrix
from sklearn.feature_extraction.text import CountVectorizer

from .text import tokenize


class BM25Index:
    def __init__(self, k1=1.5, b=0.75):
        self.k1 = k1
        self.b = b
        self.vocab = {}
        self.idf = None
        self.matrix = None
        self.n_docs = 0

    def fit(self, texts):
        vectorizer = CountVectorizer(
            tokenizer=tokenize, lowercase=False, token_pattern=None, dtype=np.float32
        )
        counts = vectorizer.fit_transform(texts).tocoo()
        self.n_docs = counts.shape[0]
        doc_len = np.bincount(counts.row, weights=counts.data, minlength=self.n_docs)
        avg_len = max(float(doc_len.mean()), 1e-9)
        doc_freq = np.bincount(counts.col, minlength=counts.shape[1])
        self.idf = np.log(1.0 + (self.n_docs - doc_freq + 0.5) / (doc_freq + 0.5)).astype(np.float32)
        denom = counts.data + self.k1 * (1.0 - self.b + self.b * doc_len[counts.row] / avg_len)
        weights = (counts.data * (self.k1 + 1.0) / denom).astype(np.float32)
        self.matrix = csc_matrix((weights, (counts.row, counts.col)), shape=counts.shape)
        self.vocab = {term: int(idx) for term, idx in vectorizer.vocabulary_.items()}
        return self

    def score(self, query):
        scores = np.zeros(self.n_docs, dtype=np.float32)
        seen = set()
        for term in tokenize(query):
            idx = self.vocab.get(term)
            if idx is None or idx in seen:
                continue
            seen.add(idx)
            start, end = self.matrix.indptr[idx], self.matrix.indptr[idx + 1]
            scores[self.matrix.indices[start:end]] += self.idf[idx] * self.matrix.data[start:end]
        return scores

    def save(self, path):
        state = {
            "k1": self.k1,
            "b": self.b,
            "vocab": self.vocab,
            "idf": self.idf,
            "matrix": self.matrix,
            "n_docs": self.n_docs,
        }
        with open(path, "wb") as handle:
            pickle.dump(state, handle, protocol=pickle.HIGHEST_PROTOCOL)

    @classmethod
    def load(cls, path):
        with open(path, "rb") as handle:
            state = pickle.load(handle)
        index = cls(state["k1"], state["b"])
        index.vocab = state["vocab"]
        index.idf = state["idf"]
        index.matrix = state["matrix"]
        index.n_docs = state["n_docs"]
        return index
