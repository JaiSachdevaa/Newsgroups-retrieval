import numpy as np


class Embedder:
    def __init__(self, model_name):
        self.model_name = model_name
        self.model = None

    def load(self):
        if self.model is None:
            from sentence_transformers import SentenceTransformer

            self.model = SentenceTransformer(self.model_name)
            self.model.max_seq_length = 256
        return self.model

    def encode(self, texts, batch_size=64, show_progress=False):
        vectors = self.load().encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=True,
            show_progress_bar=show_progress,
            convert_to_numpy=True,
        )
        return vectors.astype(np.float32)


class Reranker:
    def __init__(self, model_name):
        self.model_name = model_name
        self.model = None

    def load(self):
        if self.model is None:
            from sentence_transformers import CrossEncoder

            self.model = CrossEncoder(self.model_name, max_length=384)
        return self.model

    def score(self, pairs):
        return self.load().predict(pairs, batch_size=32)
