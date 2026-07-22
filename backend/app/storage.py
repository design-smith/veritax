from __future__ import annotations

import uuid
from typing import Protocol

import boto3
from botocore.client import Config

from .config import settings


def build_key(engagement_id, source_id, filename: str) -> str:
    return f"engagements/{engagement_id}/sources/{source_id}/{uuid.uuid4()}-{filename}"


class Storage(Protocol):
    bucket: str

    def put(self, key: str, data: bytes, content_type: str | None = None) -> None: ...
    def get(self, key: str) -> bytes: ...


class S3Storage:
    """MinIO / S3-compatible object storage via boto3."""

    def __init__(self) -> None:
        self.bucket = settings.s3_bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            config=Config(signature_version="s3v4"),
        )

    def ensure_bucket(self) -> None:
        existing = {b["Name"] for b in self._client.list_buckets().get("Buckets", [])}
        if self.bucket not in existing:
            self._client.create_bucket(Bucket=self.bucket)

    def put(self, key: str, data: bytes, content_type: str | None = None) -> None:
        extra = {"ContentType": content_type} if content_type else {}
        self._client.put_object(Bucket=self.bucket, Key=key, Body=data, **extra)

    def get(self, key: str) -> bytes:
        return self._client.get_object(Bucket=self.bucket, Key=key)["Body"].read()


class InMemoryStorage:
    """Test double — keeps object bytes in a dict, no network."""

    def __init__(self, bucket: str = "test-bucket") -> None:
        self.bucket = bucket
        self._objects: dict[str, bytes] = {}

    def ensure_bucket(self) -> None:  # noqa: D401 - parity with S3Storage
        pass

    def put(self, key: str, data: bytes, content_type: str | None = None) -> None:
        self._objects[key] = data

    def get(self, key: str) -> bytes:
        return self._objects[key]
