import type { PlaceholderStatus } from "@/types/data-contract";

export function PlaceholderBanner({
  status,
}: {
  status: PlaceholderStatus;
}) {
  if (!status.any) return null;

  const whichEntries: Array<[
    "district_gaps" | "simulator_grid" | "profiles" | "model_metrics",
    boolean,
  ]> = [
    ["district_gaps", status.district_gaps],
    ["simulator_grid", status.simulator_grid],
    ["profiles", status.profiles],
    ["model_metrics", status.model_metrics],
  ];
  const which = whichEntries
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(", ");

  const note =
    status.notes.district_gaps ??
    status.notes.simulator_grid ??
    status.notes.profiles ??
    status.notes.model_metrics;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="w-full border-b border-amber-500/40 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm dark:border-amber-500/60 dark:bg-amber-950/70 dark:text-amber-100 sm:px-6 min-w-0"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4 min-w-0">
        <div className="flex items-start gap-3 min-w-0">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              Placeholder data in use — do not quote these numbers publicly
            </p>
            <p className="mt-0.5 text-sm opacity-90">
              These files contain synthetic, invented values:{" "}
              <span className="font-medium">{which}</span>. They are for UI
              layout only and will be replaced by real pipeline output before
              any publication.
            </p>
            {note ? (
              <details className="mt-2 text-xs opacity-90">
                <summary className="cursor-pointer underline-offset-2 hover:underline">
                  View the embedded disclosure from the data file(s)
                </summary>
                <p className="mt-1 whitespace-pre-wrap rounded border border-current/20 bg-white/40 p-2 font-mono text-[11px] dark:bg-black/20">
                  {note}
                </p>
              </details>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 self-start rounded-full border border-current/30 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide opacity-80">
          placeholder
        </span>
      </div>
    </div>
  );
}
