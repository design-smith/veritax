import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createRecordIdentity, createRecordService, isRecordError, stringifyRecordRef } from "../index";

describe("Record manifests and artifacts", () => {
  it("registers a manifest with pinned inputs and a run completion event", () => {
    const record = createRecordService();
    const jobRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "run" }).ref;
    const entityRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "entity", version: 3 }).ref;

    const result = record.registerManifest({
      tenantId: "tenant-a",
      idempotencyKey: "manifest-local-file-run",
      actor: { kind: "system", id: "runtime" },
      jobRef,
      corpusVersion: 12,
      rulepackVersions: { transfer_pricing: "2026.1.0" },
      modelVersions: { drafter: "gpt-5.1" },
      instructionRefs: [createRecordIdentity({ tenantId: "tenant-a", objectType: "instruction" }).ref.objectId],
      gateRefs: [createRecordIdentity({ tenantId: "tenant-a", objectType: "gate" }).ref.objectId],
      inputPins: [{ ref: entityRef, version: 3 }],
      outputHashes: { "local-file.pdf": "sha256:6c1aef" },
      registeredAt: "2026-02-07T09:00:00.000Z",
    });

    expect(result.manifest).toMatchObject({
      tenantId: "tenant-a",
      jobRef,
      corpusVersion: 12,
      rulepackVersions: { transfer_pricing: "2026.1.0" },
      modelVersions: { drafter: "gpt-5.1" },
      inputPins: [{ ref: entityRef, version: 3 }],
      outputHashes: { "local-file.pdf": "sha256:6c1aef" },
      registeredBy: { kind: "system", id: "runtime" },
      registeredAt: "2026-02-07T09:00:00.000Z",
    });
    expect(result.event).toMatchObject({
      type: "run.completed",
      manifestRef: result.manifest.manifestId,
      payload: {
        runRef: stringifyRecordRef(jobRef),
        manifestId: result.manifest.manifestId,
        corpusVersion: 12,
        inputPinCount: 1,
      },
    });
  });

  it("refuses unpinned manifests and returns manifest pins for replay", () => {
    const record = createRecordService();
    const jobRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "run" }).ref;
    const agreementRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "agreement", version: 2 }).ref;
    const documentRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "document", version: 5 }).ref;

    try {
      record.registerManifest({
        tenantId: "tenant-a",
        idempotencyKey: "manifest-without-pins",
        actor: { kind: "system", id: "runtime" },
        jobRef,
        corpusVersion: 12,
        inputPins: [],
      });
      throw new Error("Expected manifest registration to fail.");
    } catch (error) {
      expect(isRecordError(error)).toBe(true);
      if (isRecordError(error)) {
        expect(error.code).toBe("INVALID_MANIFEST");
      }
    }

    const registered = record.registerManifest({
      tenantId: "tenant-a",
      idempotencyKey: "manifest-with-pins",
      actor: { kind: "system", id: "runtime" },
      jobRef,
      corpusVersion: 12,
      inputPins: [
        { ref: documentRef, version: 5 },
        { ref: agreementRef, version: 2 },
      ],
      rulepackVersions: { tp: "2026.1" },
      modelVersions: { checker: "gpt-5.1" },
      registeredAt: "2026-02-07T10:00:00.000Z",
    });

    expect(record.getManifest({ tenantId: "tenant-a", manifestId: registered.manifest.manifestId })).toEqual(
      registered.manifest,
    );
    expect(record.getManifestPins({ tenantId: "tenant-a", manifestId: registered.manifest.manifestId })).toEqual({
      tenantId: "tenant-a",
      manifestId: registered.manifest.manifestId,
      corpusVersion: 12,
      inputPins: [
        { ref: agreementRef, version: 2 },
        { ref: documentRef, version: 5 },
      ],
      instructionRefs: [],
      gateRefs: [],
      rulepackVersions: { tp: "2026.1" },
      modelVersions: { checker: "gpt-5.1" },
    });
    expect(record.getManifest({ tenantId: "tenant-b", manifestId: registered.manifest.manifestId })).toBeNull();
  });

  it("registers artifacts only against a manifest and emits artifact rendered", () => {
    const record = createRecordService();
    const jobRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "run" }).ref;
    const sourceRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "document", version: 1 }).ref;
    const manifest = record.registerManifest({
      tenantId: "tenant-a",
      idempotencyKey: "manifest-for-artifact",
      actor: { kind: "system", id: "runtime" },
      jobRef,
      corpusVersion: 4,
      inputPins: [{ ref: sourceRef, version: 1 }],
      outputHashes: { "board-pack.pdf": "sha256:board-pack-v1" },
      registeredAt: "2026-02-08T09:00:00.000Z",
    }).manifest;

    const result = record.registerArtifact({
      tenantId: "tenant-a",
      idempotencyKey: "artifact-board-pack",
      actor: { kind: "system", id: "assembler" },
      manifestId: manifest.manifestId,
      format: "pdf",
      blobRef: "blob://tenant-a/artifacts/board-pack-v1.pdf",
      contentHash: "sha256:board-pack-v1",
      renderedAt: "2026-02-08T09:01:00.000Z",
    });

    expect(result.artifact).toMatchObject({
      tenantId: "tenant-a",
      manifestId: manifest.manifestId,
      format: "pdf",
      blobRef: "blob://tenant-a/artifacts/board-pack-v1.pdf",
      contentHash: "sha256:board-pack-v1",
      sealed: false,
      sealedEvent: null,
      renderedBy: { kind: "system", id: "assembler" },
      renderedAt: "2026-02-08T09:01:00.000Z",
    });
    expect(result.event).toMatchObject({
      type: "artifact.rendered",
      manifestRef: manifest.manifestId,
      payload: {
        artifactId: result.artifact.artifactId,
        manifestId: manifest.manifestId,
        format: "pdf",
        contentHash: "sha256:board-pack-v1",
      },
    });
    expect(record.getArtifact({ tenantId: "tenant-a", artifactId: result.artifact.artifactId })).toEqual(result.artifact);
    expect(record.listArtifacts({ tenantId: "tenant-a", manifestId: manifest.manifestId })).toEqual([result.artifact]);
  });

  it("refuses artifacts without an existing manifest", () => {
    const record = createRecordService();
    const missingManifestId = createRecordIdentity({ tenantId: "tenant-a", objectType: "manifest" }).ref.objectId;

    try {
      record.registerArtifact({
        tenantId: "tenant-a",
        idempotencyKey: "artifact-missing-manifest",
        actor: { kind: "system", id: "assembler" },
        manifestId: missingManifestId,
        format: "pdf",
        blobRef: "blob://tenant-a/artifacts/missing.pdf",
        contentHash: "sha256:missing",
      });
      throw new Error("Expected artifact registration to fail.");
    } catch (error) {
      expect(isRecordError(error)).toBe(true);
      if (isRecordError(error)) {
        expect(error.code).toBe("MANIFEST_NOT_FOUND");
      }
    }
  });

  it("seals an artifact with an artifact sealed event", () => {
    const record = createRecordService();
    const jobRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "run" }).ref;
    const sourceRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "document", version: 1 }).ref;
    const manifest = record.registerManifest({
      tenantId: "tenant-a",
      idempotencyKey: "manifest-for-seal",
      actor: { kind: "system", id: "runtime" },
      jobRef,
      corpusVersion: 4,
      inputPins: [{ ref: sourceRef, version: 1 }],
      registeredAt: "2026-02-08T10:00:00.000Z",
    }).manifest;
    const artifact = record.registerArtifact({
      tenantId: "tenant-a",
      idempotencyKey: "artifact-to-seal",
      actor: { kind: "system", id: "assembler" },
      manifestId: manifest.manifestId,
      format: "pdf",
      blobRef: "blob://tenant-a/artifacts/final.pdf",
      contentHash: "sha256:final-v1",
      renderedAt: "2026-02-08T10:01:00.000Z",
    }).artifact;

    const sealed = record.sealArtifact({
      tenantId: "tenant-a",
      idempotencyKey: "seal-final",
      actor: { kind: "user", id: "reviewer-1" },
      artifactId: artifact.artifactId,
      sealedAt: "2026-02-08T10:05:00.000Z",
    });

    expect(sealed.event).toMatchObject({
      type: "artifact.sealed",
      manifestRef: manifest.manifestId,
      payload: {
        artifactId: artifact.artifactId,
        manifestId: manifest.manifestId,
        contentHash: "sha256:final-v1",
      },
    });
    expect(sealed.artifact).toMatchObject({
      artifactId: artifact.artifactId,
      contentHash: "sha256:final-v1",
      sealed: true,
      sealedEvent: sealed.event.seq,
    });
    expect(record.getArtifact({ tenantId: "tenant-a", artifactId: artifact.artifactId })).toEqual(sealed.artifact);
  });

  it("verifies a golden dossier replay against the stored artifact hash and manifest pins", () => {
    const record = createRecordService();
    const jobRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "run" }).ref;
    const sourceRef = createRecordIdentity({ tenantId: "tenant-a", objectType: "document", version: 9 }).ref;
    const content = "Golden dossier bytes v1\nentity=Helios\nperiod=FY2026";
    const contentHash = `sha256:${createHash("sha256").update(content).digest("hex")}`;
    const manifest = record.registerManifest({
      tenantId: "tenant-a",
      idempotencyKey: "manifest-golden-dossier",
      actor: { kind: "system", id: "runtime" },
      jobRef,
      corpusVersion: 42,
      inputPins: [{ ref: sourceRef, version: 9 }],
      outputHashes: { "annual-dossier.pdf": contentHash },
      registeredAt: "2026-02-09T10:00:00.000Z",
    }).manifest;
    const artifact = record.registerArtifact({
      tenantId: "tenant-a",
      idempotencyKey: "artifact-golden-dossier",
      actor: { kind: "system", id: "assembler" },
      manifestId: manifest.manifestId,
      format: "pdf",
      blobRef: "blob://tenant-a/artifacts/annual-dossier.pdf",
      contentHash,
      renderedAt: "2026-02-09T10:01:00.000Z",
    }).artifact;
    record.sealArtifact({
      tenantId: "tenant-a",
      idempotencyKey: "seal-golden-dossier",
      actor: { kind: "user", id: "reviewer-1" },
      artifactId: artifact.artifactId,
      sealedAt: "2026-02-09T10:05:00.000Z",
    });

    expect(
      record.verifyArtifactReplay({
        tenantId: "tenant-a",
        artifactId: artifact.artifactId,
        renderedContent: content,
      }),
    ).toMatchObject({
      ok: true,
      artifactId: artifact.artifactId,
      manifestId: manifest.manifestId,
      expectedHash: contentHash,
      actualHash: contentHash,
      corpusVersion: 42,
      inputPins: [{ ref: sourceRef, version: 9 }],
    });
    expect(
      record.verifyArtifactReplay({
        tenantId: "tenant-a",
        artifactId: artifact.artifactId,
        renderedContent: `${content}\nchanged`,
      }),
    ).toMatchObject({
      ok: false,
      expectedHash: contentHash,
    });
  });
});
