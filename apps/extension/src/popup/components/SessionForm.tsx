import { useState } from "react";
import type { SessionCategory } from "@antarix/types";

const CATEGORIES: Array<{ value: SessionCategory; label: string; emoji: string }> = [
  { value: "dsa", label: "DSA", emoji: "🧩" },
  { value: "coding", label: "Coding", emoji: "💻" },
  { value: "project", label: "Project", emoji: "🚀" },
  { value: "learning", label: "Learning", emoji: "📚" },
  { value: "research", label: "Research", emoji: "🔬" },
];

export interface SessionStartData {
  category: SessionCategory;
  projectName: string;
}

export function SessionForm({ onStart, disabled }: { onStart: (data: SessionStartData) => void; disabled?: boolean }) {
  const [category, setCategory] = useState<SessionCategory>("coding");
  const [projectName, setProjectName] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onStart({ category, projectName: projectName.trim() });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label className="label" htmlFor="category">Category</label>
        <div className="chips">
          {CATEGORIES.map((cat) => (
            <button
              type="button"
              key={cat.value}
              className={`chip ${category === cat.value ? "chip--active" : ""}`}
              onClick={() => setCategory(cat.value)}
            >
              <span aria-hidden="true">{cat.emoji}</span> {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="project">Project (optional)</label>
        <input
          id="project"
          className="input"
          type="text"
          placeholder="e.g. Sign Language Recognition"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          maxLength={255}
        />
      </div>

      <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={disabled}>
        Start Session
      </button>
    </form>
  );
}
