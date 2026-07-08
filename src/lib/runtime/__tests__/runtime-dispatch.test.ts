import { describe, expect, it } from "vitest";

import { createRuntimeService, RuntimeError } from "../index";

describe("Runtime priority-lane dispatch", () => {
  it("claims queued runs by priority lane and replays the claim idempotently", () => {
    const runtime = createRuntimeService();
    const background = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "background-run",
      kind: "pipeline",
      initiator: { kind: "system", ref: "pipeline:nightly" },
      priorityLane: "background",
    }).job;
    const interactive = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "interactive-run",
      kind: "engine",
      initiator: { kind: "user", ref: "user:tp-manager" },
      priorityLane: "interactive",
    }).job;
    const standard = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "standard-run",
      kind: "pipeline",
      initiator: { kind: "system", ref: "pipeline:refresh" },
      priorityLane: "standard",
    }).job;

    const first = runtime.claimNextJob({
      tenantId: "tenant-a",
      idempotencyKey: "claim-first",
      workerId: "worker-a",
      claimedAt: "2026-06-19T23:00:00.000Z",
    });
    const replay = runtime.claimNextJob({
      tenantId: "tenant-a",
      idempotencyKey: "claim-first",
      workerId: "worker-a",
      claimedAt: "2026-06-19T23:00:00.000Z",
    });
    const second = runtime.claimNextJob({
      tenantId: "tenant-a",
      idempotencyKey: "claim-second",
      workerId: "worker-b",
      lanes: ["standard", "background"],
      claimedAt: "2026-06-19T23:01:00.000Z",
    });

    expect(replay).toEqual(first);
    expect(first).toMatchObject({
      job: {
        jobId: interactive.jobId,
        status: "planning",
        priorityLane: "interactive",
      },
      claim: {
        tenantId: "tenant-a",
        jobId: interactive.jobId,
        workerId: "worker-a",
        status: "active",
        claimedAt: "2026-06-19T23:00:00.000Z",
      },
    });
    expect(second).toMatchObject({
      job: {
        jobId: standard.jobId,
        status: "planning",
        priorityLane: "standard",
      },
      claim: {
        workerId: "worker-b",
        status: "active",
      },
    });
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: interactive.jobId })?.status).toBe("planning");
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: standard.jobId })?.status).toBe("planning");
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: background.jobId })?.status).toBe("queued");
    expect(runtime.streamRun({ tenantId: "tenant-a", jobId: interactive.jobId }).events.map((event) => event.type)).toEqual([
      "run.queued",
      "run.planning",
    ]);
  });

  it("releases an unstarted claim back to the queued lane", () => {
    const runtime = createRuntimeService();
    const job = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "release-claim-run",
      kind: "pipeline",
      initiator: { kind: "system", ref: "pipeline:nightly" },
      priorityLane: "batch",
    }).job;
    const claimed = runtime.claimNextJob({
      tenantId: "tenant-a",
      idempotencyKey: "claim-release-target",
      workerId: "worker-a",
      claimedAt: "2026-06-19T23:10:00.000Z",
    });

    const released = runtime.releaseJobClaim({
      tenantId: "tenant-a",
      claimId: claimed.claim!.claimId,
      idempotencyKey: "release-claim",
      releasedAt: "2026-06-19T23:11:00.000Z",
      reason: "Worker lost its sandbox before starting the run.",
    });
    const next = runtime.claimNextJob({
      tenantId: "tenant-a",
      idempotencyKey: "claim-after-release",
      workerId: "worker-b",
      claimedAt: "2026-06-19T23:12:00.000Z",
    });

    expect(released).toMatchObject({
      job: {
        jobId: job.jobId,
        status: "queued",
      },
      claim: {
        claimId: claimed.claim!.claimId,
        status: "released",
        releasedAt: "2026-06-19T23:11:00.000Z",
        releaseReason: "Worker lost its sandbox before starting the run.",
      },
    });
    expect(next.job?.jobId).toBe(job.jobId);
    expect(next.claim).toMatchObject({ workerId: "worker-b", status: "active" });
  });

  it("does not dispatch when a tenant kill switch is active", () => {
    const runtime = createRuntimeService();
    const job = runtime.submitJob({
      tenantId: "tenant-a",
      idempotencyKey: "queued-before-dispatch-kill",
      kind: "pipeline",
      initiator: { kind: "system", ref: "pipeline:nightly" },
      priorityLane: "interactive",
    }).job;

    runtime.setKillSwitch({
      tenantId: "tenant-a",
      idempotencyKey: "halt-before-claim",
      actor: { kind: "user", ref: "user:ops-lead" },
      scope: { kind: "tenant" },
      enabled: true,
      reason: "Stop dispatch during an incident.",
    });

    expect(() =>
      runtime.claimNextJob({
        tenantId: "tenant-a",
        idempotencyKey: "blocked-claim",
        workerId: "worker-a",
      }),
    ).toThrow(RuntimeError);
    expect(runtime.getRun({ tenantId: "tenant-a", jobId: job.jobId })?.status).toBe("queued");
  });
});
