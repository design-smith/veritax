from __future__ import annotations

import hashlib
from typing import Protocol

from .config import settings


class Embedder(Protocol):
    dim: int

    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...


# Voyage caps a single embed request (docs + tokens). Stay well under both — a full annual report
# is hundreds of chunks, so one call would 400. ponytail: fixed batch of 64 (~50K tokens); shrink if
# Voyage tightens the per-request token limit.
_VOYAGE_BATCH = 64


class VoyageEmbedder:
    """Voyage AI embeddings (voyage-law-2, 1024-dim) — tuned for legal/tax text."""

    def __init__(self) -> None:
        self.dim = settings.embedding_dim
        self._model = settings.embedding_model
        self._client = None  # lazy: lets the app boot without a key until an embed is needed

    def _get_client(self):
        if self._client is None:
            import voyageai

            self._client = voyageai.Client(api_key=settings.voyage_api_key)
        return self._client

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        client = self._get_client()
        out: list[list[float]] = []
        for i in range(0, len(texts), _VOYAGE_BATCH):
            batch = texts[i : i + _VOYAGE_BATCH]
            out.extend(client.embed(batch, model=self._model, input_type="document").embeddings)
        return out


class FakeEmbedder:
    """Deterministic test double — hashes text into a fixed-dim unit-ish vector. No network."""

    def __init__(self, dim: int | None = None) -> None:
        self.dim = dim or settings.embedding_dim

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        out: list[list[float]] = []
        for t in texts:
            seed = hashlib.sha256(t.encode("utf-8")).digest()
            vec = [((seed[i % len(seed)] / 255.0) - 0.5) for i in range(self.dim)]
            out.append(vec)
        return out
