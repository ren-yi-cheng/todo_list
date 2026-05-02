export type Toast = {
  id: string;
  title: string;
  body?: string;
  actions?: Array<{ label: string; onClick: () => void }>;
  onClose?: () => void;
};

export default function ToastHost({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toastHost" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <div className="toastHeader">
            <div className="toastTitle">{t.title}</div>
            <button className="iconButton" onClick={t.onClose} aria-label="关闭提醒">
              ✕
            </button>
          </div>
          {t.body ? <div className="toastBody">{t.body}</div> : null}
          {t.actions && t.actions.length ? (
            <div className="toastActions">
              {t.actions.map((a) => (
                <button key={a.label} className="button buttonSecondary" onClick={a.onClick}>
                  {a.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
