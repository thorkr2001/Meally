export function MealRecipeInfo({
  sourceUrl,
  notes,
  className,
}: {
  sourceUrl: string | null;
  notes: string | null;
  className?: string;
}) {
  if (!sourceUrl && !notes) return null;

  return (
    <div className={className}>
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs text-primary-hover underline"
        >
          📖 View recipe
        </a>
      )}
      {notes && <p className="mt-1 text-xs text-ink-faint italic">{notes}</p>}
    </div>
  );
}
