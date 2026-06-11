"use client";

// apps/web/src/app/(college)/faculty/grade/faculty-grade-form.tsx
// Client form. POSTs to /api/faculty/grade.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AssignmentOption {
  id: string;
  label: string;
  max_grade: number;
}
interface StudentOption {
  user_id: string;
  label: string;
}

export function FacultyGradeForm({
  assignments,
  students,
}: {
  assignments: AssignmentOption[];
  students: StudentOption[];
}) {
  const [assignmentId, setAssignmentId] = useState(assignments[0]?.id ?? "");
  const [studentId, setStudentId] = useState(students[0]?.user_id ?? "");
  const [grade, setGrade] = useState<number | "">("");
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();

  const selectedAssignment = assignments.find((a) => a.id === assignmentId);
  const max = selectedAssignment?.max_grade ?? 100;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentId || !studentId || grade === "") {
      toast.error("Pick an assignment, a student, and a grade.");
      return;
    }
    if (typeof grade === "number" && (grade < 0 || grade > max)) {
      toast.error(`Grade must be between 0 and ${max}.`);
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/faculty/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          assignment_id: assignmentId,
          grade,
          comment: comment.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? "Failed to submit grade");
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { recompute_eta?: string };
      toast.success(`Grade saved. Score recompute in ${json.recompute_eta ?? "~6 hours"}.`);
      setGrade("");
      setComment("");
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="assignment">Assignment</Label>
          <select
            id="assignment"
            value={assignmentId}
            onChange={(e) => setAssignmentId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label} (max {a.max_grade})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="student">Student</Label>
          <select
            id="student"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {students.map((s) => (
              <option key={s.user_id} value={s.user_id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="grade">Grade (0–{max})</Label>
          <Input
            id="grade"
            type="number"
            min={0}
            max={max}
            value={grade === "" ? "" : grade}
            onChange={(e) => setGrade(e.target.value === "" ? "" : Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="comment">Comment (optional)</Label>
          <Textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            rows={3}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting..." : "Submit grade"}
        </Button>
      </div>
    </form>
  );
}
