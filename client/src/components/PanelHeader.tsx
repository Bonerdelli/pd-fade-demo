import type { ReactNode } from "react";

export const PANEL_HEADER_BUTTON_CLASS = "rounded px-3 py-1 text-sm";

interface PanelHeaderProps {
  title: string;
  actions: ReactNode;
}

export function PanelHeader({ title, actions }: PanelHeaderProps) {
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
      <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
    </header>
  );
}
