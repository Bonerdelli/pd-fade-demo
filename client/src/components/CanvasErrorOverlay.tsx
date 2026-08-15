import { useTranslation } from "react-i18next";

export interface CanvasErrorOverlayProps {
  message: string;
  onRetry?: (() => void) | null;
  overlay?: boolean;
}

export function CanvasErrorOverlay({
  message,
  onRetry,
  overlay = false,
}: CanvasErrorOverlayProps) {
  const { t } = useTranslation("common");

  return (
    <div
      className={
        overlay
          ? "absolute inset-0 z-20 flex items-center justify-center bg-white/90 p-8"
          : "flex h-full items-center justify-center p-8"
      }
      role="alert"
    >
      <div className="max-w-md space-y-3 text-center">
        <p className="text-sm text-red-600">{message}</p>
        {onRetry ? (
          <button
            type="button"
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
            onClick={() => onRetry()}
          >
            {t("status.retry")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
