export function SectionTitle({
  en,
  title,
  description,
  meta,
}: {
  en?: string;
  title: string;
  description?: string;
  meta?: string;
}) {
  return (
    <div className="theme-hairline mb-4 flex flex-col gap-2 border-b pb-3 sm:mb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
      <div className="min-w-0">
        {en && (
          <p className="text-[10px] font-semibold tracking-[0.28em] text-accent">{en}</p>
        )}
        <h2 className="theme-ink mt-1 text-lg font-semibold tracking-wide sm:text-xl">
          {title}
        </h2>
        {description && (
          <p className="theme-ink-faint mt-1 text-xs sm:text-sm">{description}</p>
        )}
      </div>
      {meta && (
        <span className="theme-ink-faint shrink-0 font-mono text-[10px] tracking-wider sm:text-xs">
          {meta}
        </span>
      )}
    </div>
  );
}
