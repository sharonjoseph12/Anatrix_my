// tests/integration/signal-audit-writer.test.ts — 11/10 — Audit writer integration tests
// Spec: specs/006-deep-signal-capture/spec.md FR-PRI-004, FR-AUD-001
// Coverage: writeSignalAudit row shape, error handling, null actor, optional hash

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));
const mockSupabase = { from: mockFrom };
const mockCreateSupabaseServerClient = vi.fn(async () => mockSupabase);

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const { writeSignalAudit } = await import("@/lib/audit/log");

describe("writeSignalAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls supabase.from('signal_audit').insert with correct row shape", async () => {
    mockInsert.mockResolvedValue({ error: null });

    await writeSignalAudit({
      actor_id: "user-1",
      actor_type: "student",
      student_id: "stu-1",
      provider: "ide_vscode",
      action: "upload",
      byte_count: 4096,
    });

    expect(mockFrom).toHaveBeenCalledWith("signal_audit");
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const row = mockInsert.mock.calls[0]![0];
    expect(row.actor_id).toBe("user-1");
    expect(row.actor_type).toBe("student");
    expect(row.student_id).toBe("stu-1");
    expect(row.provider).toBe("ide_vscode");
    expect(row.action).toBe("upload");
    expect(row.byte_count).toBe(4096);
  });

  it("throws on supabase error", async () => {
    mockInsert.mockResolvedValue({ error: { message: "insert failed" } });

    await expect(
      writeSignalAudit({
        actor_id: "user-1",
        actor_type: "student",
        student_id: "stu-1",
        provider: "ide_vscode",
        action: "upload",
      }),
    ).rejects.toThrow("writeSignalAudit: insert failed");
  });

  it("the inserted row has payload_redacted: true", async () => {
    mockInsert.mockResolvedValue({ error: null });

    await writeSignalAudit({
      actor_id: "user-1",
      actor_type: "student",
      student_id: "stu-1",
      provider: "ide_vscode",
      action: "upload",
    });

    const row = mockInsert.mock.calls[0]![0];
    expect(row.payload_redacted).toBe(true);
  });

  it("accepts null actor_id (system event)", async () => {
    mockInsert.mockResolvedValue({ error: null });

    await writeSignalAudit({
      actor_id: null,
      actor_type: "system",
      student_id: "stu-1",
      provider: "privacy_center",
      action: "read",
    });

    const row = mockInsert.mock.calls[0]![0];
    expect(row.actor_id).toBeNull();
    expect(row.actor_type).toBe("system");
  });

  it("accepts optional aggregate_hash", async () => {
    mockInsert.mockResolvedValue({ error: null });

    await writeSignalAudit({
      actor_id: "user-1",
      actor_type: "student",
      student_id: "stu-1",
      provider: "ide_vscode",
      action: "upload",
      aggregate_hash: "sha256-abc123",
    });

    const row = mockInsert.mock.calls[0]![0];
    expect(row.aggregate_hash).toBe("sha256-abc123");
  });
});
