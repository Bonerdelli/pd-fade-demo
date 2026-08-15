import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../../store/index.js";

export interface AgentShapePopupProps {
  shapeId: string;
  label: string;
  disabled: boolean;
  onClose: () => void;
  onAddComment: (text: string) => void;
}

export function AgentShapePopup({
  shapeId,
  label,
  disabled,
  onClose,
  onAddComment,
}: AgentShapePopupProps) {
  const { t } = useTranslation("map");
  const [draft, setDraft] = useState("");
  const comments = useAppStore((state) => state.userState.comments);
  const agentShapeIds = useAppStore((state) =>
    new Set(state.agentState.map.shapes.map((shape) => shape.id)),
  );

  const shapeComments = useMemo(
    () =>
      comments.filter(
        (comment) => comment.targetShapeId === shapeId && agentShapeIds.has(comment.targetShapeId),
      ),
    [agentShapeIds, comments, shapeId],
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || disabled) {
      return;
    }
    onAddComment(text);
    setDraft("");
  };

  return (
    <div className="absolute bottom-3 right-3 z-20 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            {t("popup.agentShape")}
          </p>
          <h3 className="text-sm font-semibold text-slate-900">{label || t("popup.untitledShape")}</h3>
        </div>
        <button
          type="button"
          className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100"
          onClick={onClose}
          aria-label={t("popup.close")}
        >
          {t("popup.close")}
        </button>
      </div>

      <div className="mb-3 max-h-32 space-y-2 overflow-y-auto">
        {shapeComments.length === 0 ? (
          <p className="text-xs text-slate-500">{t("popup.noComments")}</p>
        ) : (
          shapeComments.map((comment) => (
            <p key={comment.id} className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
              {comment.text}
            </p>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <label className="block text-xs font-medium text-slate-600" htmlFor="agent-shape-comment">
          {t("popup.addCommentLabel")}
        </label>
        <textarea
          id="agent-shape-comment"
          className="w-full resize-none rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-800 disabled:bg-slate-50"
          rows={2}
          value={draft}
          disabled={disabled}
          placeholder={t("popup.commentPlaceholder")}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="submit"
          className="w-full rounded bg-violet-700 px-2 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:bg-violet-300"
          disabled={disabled || draft.trim().length === 0}
        >
          {t("popup.submitComment")}
        </button>
      </form>
    </div>
  );
}
