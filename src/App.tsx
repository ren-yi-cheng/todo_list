import { useEffect, useMemo, useRef, useState } from "react";
import type { Settings, Todo } from "./types";
import Modal from "./components/Modal";
import TodoEditor, { type TodoDraft } from "./components/TodoEditor";
import ToastHost, { type Toast } from "./components/ToastHost";
import { makeId } from "./lib/id";
import { loadJson, saveJson } from "./lib/storage";
import { compareMaybeIso, formatLocal, nowIso, parseIso } from "./lib/time";
import { playBeep } from "./lib/sound";

const TODOS_KEY = "todo_reminder_v1.todos";
const SETTINGS_KEY = "todo_reminder_v1.settings";

type Filter = "all" | "active" | "completed";

const defaultSettings: Settings = {
  soundEnabled: true,
  notificationsEnabled: false,
};

function ensureTodos(value: unknown): Todo[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(Boolean)
    .map((t) => t as Partial<Todo>)
    .filter((t) => typeof t.id === "string" && typeof t.title === "string")
    .map((t) => ({
      id: t.id!,
      title: t.title!,
      note: typeof t.note === "string" ? t.note : "",
      dueAt: typeof t.dueAt === "string" ? t.dueAt : null,
      remindAt: typeof t.remindAt === "string" ? t.remindAt : null,
      reminderFiredAt: typeof t.reminderFiredAt === "string" ? t.reminderFiredAt : null,
      reminderDismissedAt: typeof t.reminderDismissedAt === "string" ? t.reminderDismissedAt : null,
      completedAt: typeof t.completedAt === "string" ? t.completedAt : null,
      createdAt: typeof t.createdAt === "string" ? t.createdAt : nowIso(),
      updatedAt: typeof t.updatedAt === "string" ? t.updatedAt : nowIso(),
    }));
}

function ensureSettings(value: unknown): Settings {
  const s = value as Partial<Settings>;
  return {
    soundEnabled: typeof s?.soundEnabled === "boolean" ? s.soundEnabled : defaultSettings.soundEnabled,
    notificationsEnabled:
      typeof s?.notificationsEnabled === "boolean"
        ? s.notificationsEnabled
        : defaultSettings.notificationsEnabled,
  };
}

function isOverdue(todo: Todo, now: Date): boolean {
  if (!todo.dueAt) return false;
  const due = parseIso(todo.dueAt);
  if (!due) return false;
  return !todo.completedAt && due.getTime() < now.getTime();
}

export default function App() {
  const [todos, setTodos] = useState<Todo[]>(() => ensureTodos(loadJson<unknown>(TODOS_KEY, [])));
  const [settings, setSettings] = useState<Settings>(() =>
    ensureSettings(loadJson<unknown>(SETTINGS_KEY, defaultSettings)),
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const lastUserGestureAt = useRef<number | null>(null);
  const seenToastIds = useRef(new Set<string>());

  useEffect(() => {
    const onGesture = () => (lastUserGestureAt.current = Date.now());
    window.addEventListener("pointerdown", onGesture, { passive: true });
    window.addEventListener("keydown", onGesture);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, []);

  useEffect(() => {
    saveJson(TODOS_KEY, todos);
  }, [todos]);

  useEffect(() => {
    saveJson(SETTINGS_KEY, settings);
  }, [settings]);

  const counts = useMemo(() => {
    const total = todos.length;
    const completed = todos.filter((t) => Boolean(t.completedAt)).length;
    const active = total - completed;
    return { total, active, completed };
  }, [todos]);

  const sortedTodos = useMemo(() => {
    const copy = [...todos];
    copy.sort((a, b) => {
      if (a.completedAt && !b.completedAt) return 1;
      if (!a.completedAt && b.completedAt) return -1;
      const byRemind = compareMaybeIso(a.remindAt, b.remindAt);
      if (byRemind !== 0) return byRemind;
      const byDue = compareMaybeIso(a.dueAt, b.dueAt);
      if (byDue !== 0) return byDue;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    return copy;
  }, [todos]);

  const visibleTodos = useMemo(() => {
    return sortedTodos.filter((t) => {
      if (filter === "active") return !t.completedAt;
      if (filter === "completed") return Boolean(t.completedAt);
      return true;
    });
  }, [sortedTodos, filter]);

  const editingTodo = useMemo(() => todos.find((t) => t.id === editingId) ?? null, [todos, editingId]);

  const openNew = () => {
    setEditingId(null);
    setEditorOpen(true);
  };

  const openEdit = (id: string) => {
    setEditingId(id);
    setEditorOpen(true);
  };

  const closeEditor = () => setEditorOpen(false);

  const upsertTodo = (draft: TodoDraft) => {
    const ts = nowIso();
    if (!editingId) {
      const todo: Todo = {
        id: makeId(),
        title: draft.title,
        note: draft.note,
        dueAt: draft.dueAt,
        remindAt: draft.remindAt,
        reminderFiredAt: null,
        reminderDismissedAt: null,
        completedAt: null,
        createdAt: ts,
        updatedAt: ts,
      };
      setTodos((prev) => [todo, ...prev]);
      return;
    }

    setTodos((prev) =>
      prev.map((t) => {
        if (t.id !== editingId) return t;
        const remindChanged = t.remindAt !== draft.remindAt;
        return {
          ...t,
          title: draft.title,
          note: draft.note,
          dueAt: draft.dueAt,
          remindAt: draft.remindAt,
          reminderFiredAt: remindChanged ? null : t.reminderFiredAt,
          reminderDismissedAt: remindChanged ? null : t.reminderDismissedAt,
          updatedAt: ts,
        };
      }),
    );
  };

  const toggleComplete = (id: string) => {
    const ts = nowIso();
    setTodos((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              completedAt: t.completedAt ? null : ts,
              updatedAt: ts,
            }
          : t,
      ),
    );
  };

  const deleteTodo = (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const clearReminder = (id: string) => {
    const ts = nowIso();
    setTodos((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, remindAt: null, reminderFiredAt: null, reminderDismissedAt: null, updatedAt: ts }
          : t,
      ),
    );
  };

  const snooze = (id: string, minutes: number) => {
    const now = new Date();
    const ts = nowIso();
    now.setMinutes(now.getMinutes() + minutes);
    setTodos((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              remindAt: now.toISOString(),
              reminderFiredAt: null,
              reminderDismissedAt: null,
              updatedAt: ts,
            }
          : t,
      ),
    );
  };

  const requestNotifications = async () => {
    if (!("Notification" in window)) return;
    try {
      const res = await Notification.requestPermission();
      if (res === "granted") {
        setSettings((s) => ({ ...s, notificationsEnabled: true }));
      }
    } catch {
      // ignore
    }
  };

  const addToast = (toast: Toast) => {
    if (seenToastIds.current.has(toast.id)) return;
    seenToastIds.current.add(toast.id);
    setToasts((prev) => [toast, ...prev].slice(0, 5));
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Reminder loop (only works while the page is open)
  useEffect(() => {
    const tick = async () => {
      const now = new Date();
      const nowMs = now.getTime();
      const dueSoon = todos.filter((t) => {
        if (t.completedAt) return false;
        if (!t.remindAt) return false;
        if (t.reminderFiredAt || t.reminderDismissedAt) return false;
        const r = parseIso(t.remindAt);
        if (!r) return false;
        return r.getTime() <= nowMs;
      });

      if (!dueSoon.length) return;

      const firedAt = nowIso();
      setTodos((prev) =>
        prev.map((t) =>
          dueSoon.some((x) => x.id === t.id) ? { ...t, reminderFiredAt: firedAt, updatedAt: firedAt } : t,
        ),
      );

      for (const t of dueSoon) {
        const toastId = "remind_" + t.id + "_" + String(t.remindAt ?? "");
        addToast({
          id: toastId,
          title: "提醒：" + t.title,
          body: t.dueAt ? "截止：" + formatLocal(t.dueAt) : "到提醒时间了",
          actions: [
            { label: "查看/编辑", onClick: () => openEdit(t.id) },
            { label: "稍后 10 分钟", onClick: () => snooze(t.id, 10) },
            { label: "完成", onClick: () => toggleComplete(t.id) },
          ],
          onClose: () => {
            removeToast(toastId);
            const ts = nowIso();
            setTodos((prev) =>
              prev.map((x) => (x.id === t.id ? { ...x, reminderDismissedAt: ts, updatedAt: ts } : x)),
            );
          },
        });

        if (settings.soundEnabled) {
          const hasGesture = lastUserGestureAt.current && Date.now() - lastUserGestureAt.current < 1000 * 60 * 60;
          if (hasGesture) {
            try {
              await playBeep();
            } catch {
              // ignore
            }
          }
        }

        if (settings.notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification("提醒：" + t.title, {
              body: t.dueAt ? "截止：" + formatLocal(t.dueAt) : "到提醒时间了",
              tag: "todo_" + t.id,
            });
          } catch {
            // ignore
          }
        }
      }
    };

    const handle = window.setInterval(() => void tick(), 10_000);
    return () => window.clearInterval(handle);
  }, [todos, settings.notificationsEnabled, settings.soundEnabled]);

  const now = useMemo(() => new Date(), [todos.length, counts.active, filter]);
  const overdueCount = useMemo(() => todos.filter((t) => isOverdue(t, now)).length, [todos, now]);

  const editorInitial: TodoDraft = editingTodo
    ? { title: editingTodo.title, note: editingTodo.note, dueAt: editingTodo.dueAt, remindAt: editingTodo.remindAt }
    : { title: "", note: "", dueAt: null, remindAt: null };

  return (
    <div className="page">
      <ToastHost toasts={toasts} />

      <header className="header">
        <div>
          <div className="title">待办事项提醒</div>
          <div className="subtitle">
            {counts.total} 项 · 未完成 {counts.active} · 已完成 {counts.completed}
            {overdueCount ? <span className="pill pillDanger">逾期 {overdueCount}</span> : null}
          </div>
        </div>
        <div className="headerActions">
          <button className="button" onClick={openNew}>
            + 添加待办
          </button>
        </div>
      </header>

      <section className="panel">
        <div className="tabs">
          <button className={filter === "all" ? "tab tabActive" : "tab"} onClick={() => setFilter("all")}>
            全部
          </button>
          <button className={filter === "active" ? "tab tabActive" : "tab"} onClick={() => setFilter("active")}>
            未完成
          </button>
          <button
            className={filter === "completed" ? "tab tabActive" : "tab"}
            onClick={() => setFilter("completed")}
          >
            已完成
          </button>
        </div>

        <div className="settings">
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(e) => setSettings((s) => ({ ...s, soundEnabled: e.target.checked }))}
            />
            <span>声音提醒</span>
          </label>

          <label className="switch">
            <input
              type="checkbox"
              checked={settings.notificationsEnabled}
              onChange={(e) => setSettings((s) => ({ ...s, notificationsEnabled: e.target.checked }))}
              disabled={!("Notification" in window)}
            />
            <span>系统通知</span>
          </label>

          {"Notification" in window && Notification.permission !== "granted" ? (
            <button className="button buttonSecondary" onClick={() => void requestNotifications()}>
              允许通知
            </button>
          ) : null}
        </div>

        <div className="list">
          {visibleTodos.length === 0 ? (
            <div className="empty">
              <div className="emptyTitle">这里还没有待办</div>
              <div className="emptyBody">点击右上角“添加待办”，并设置提醒时间。</div>
            </div>
          ) : (
            visibleTodos.map((t) => {
              const overdue = isOverdue(t, new Date());
              return (
                <article key={t.id} className={overdue ? "card cardDanger" : "card"}>
                  <div className="cardMain">
                    <div className="cardTitleRow">
                      <div className={t.completedAt ? "cardTitle cardTitleDone" : "cardTitle"}>{t.title}</div>
                      {t.completedAt ? (
                        <span className="pill">已完成</span>
                      ) : overdue ? (
                        <span className="pill pillDanger">已逾期</span>
                      ) : null}
                    </div>
                    {t.note ? <div className="cardNote">{t.note}</div> : null}
                    <div className="meta">
                      {t.dueAt ? (
                        <span className="metaItem">
                          截止：<span className="mono">{formatLocal(t.dueAt)}</span>
                        </span>
                      ) : null}
                      {t.remindAt ? (
                        <span className="metaItem">
                          提醒：<span className="mono">{formatLocal(t.remindAt)}</span>
                        </span>
                      ) : (
                        <span className="metaItem metaMuted">未设置提醒</span>
                      )}
                    </div>
                  </div>

                  <div className="cardActions">
                    <button className="button buttonSecondary" onClick={() => toggleComplete(t.id)}>
                      {t.completedAt ? "取消完成" : "完成"}
                    </button>
                    <button className="button buttonSecondary" onClick={() => openEdit(t.id)}>
                      编辑
                    </button>
                    {t.remindAt ? (
                      <button className="button buttonGhost" onClick={() => clearReminder(t.id)}>
                        清除提醒
                      </button>
                    ) : null}
                    <button className="button buttonDanger" onClick={() => deleteTodo(t.id)}>
                      删除
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <footer className="footer">
        <div className="footerNote">说明：提醒功能需要页面保持打开；系统通知需要浏览器允许权限。时间均以本机时区为准。</div>
      </footer>

      <Modal open={editorOpen} title={editingTodo ? "编辑待办" : "新增待办"} onClose={closeEditor}>
        <TodoEditor
          initial={editorInitial}
          submitLabel={editingTodo ? "保存" : "创建"}
          onSubmit={(draft) => {
            upsertTodo(draft);
            setEditorOpen(false);
          }}
          onCancel={closeEditor}
          onClearReminder={editingTodo ? () => clearReminder(editingTodo.id) : undefined}
        />
      </Modal>
    </div>
  );
}
