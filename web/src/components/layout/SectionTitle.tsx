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
    <div className="theme-hairline mb-5 flex items-end justify-between gap-3 border-b pb-3">
      <div>
        {en && (
          <p className="text-[10px] font-semibold tracking-[0.28em] text-accent">{en}</p>
        )}
        <h2 className="theme-ink mt-1 text-xl font-semibold tracking-wide">{title}</h2>
        {description && <p className="theme-ink-faint mt-1 text-sm">{description}</p>}
      </div>
      {meta && (
        <span className="theme-ink-faint font-mono text-xs tracking-wider">{meta}</span>
      )}
    </div>
  );
}
