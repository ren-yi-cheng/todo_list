import { useMemo, useState } from "react";
import type { Todo } from "../types";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "../lib/time";

export type TodoDraft = Pick<Todo, "title" | "note" | "dueAt" | "remindAt">;

export default function TodoEditor({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  onClearReminder,
}: {
  initial: TodoDraft;
  submitLabel: string;
  onSubmit: (draft: TodoDraft) => void;
  onCancel: () => void;
  onClearReminder?: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [note, setNote] = useState(initial.note);
  const [dueAtLocal, setDueAtLocal] = useState(() => toDatetimeLocalValue(initial.dueAt));
  const [remindAtLocal, setRemindAtLocal] = useState(() => toDatetimeLocalValue(initial.remindAt));

  const canSubmit = useMemo(() => title.trim().length > 0, [title]);

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({
          title: title.trim(),
          note: note.trim(),
          dueAt: fromDatetimeLocalValue(dueAtLocal),
          remindAt: fromDatetimeLocalValue(remindAtLocal),
        });
      }}
    >
      <label className="field">
        <div className="label">标题</div>
        <input
          className="input"
          autoFocus
          value={title}
          placeholder="例如：交水电费"
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <label className="field">
        <div className="label">备注（可选）</div>
        <textarea
          className="textarea"
          value={note}
          placeholder="补充说明、地址、账号等"
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />
      </label>

      <div className="grid2">
        <label className="field">
          <div className="label">截止时间（可选）</div>
          <input
            className="input"
            type="datetime-local"
            value={dueAtLocal}
            onChange={(e) => setDueAtLocal(e.target.value)}
          />
        </label>

        <label className="field">
          <div className="label">提醒时间（可选）</div>
          <input
            className="input"
            type="datetime-local"
            value={remindAtLocal}
            onChange={(e) => setRemindAtLocal(e.target.value)}
          />
        </label>
      </div>

      <div className="row">
        <button className="button" type="submit" disabled={!canSubmit}>
          {submitLabel}
        </button>
        <button className="button buttonSecondary" type="button" onClick={onCancel}>
          取消
        </button>
        {onClearReminder ? (
          <button className="button buttonGhost" type="button" onClick={onClearReminder}>
            清除提醒
          </button>
        ) : null}
      </div>
    </form>
  );
}
