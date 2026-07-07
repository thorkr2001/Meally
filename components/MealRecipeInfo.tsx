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
          className="mt-2 inline-block text-xs text-emerald-600 underline"
        >
          📖 View recipe
        </a>
      )}
      {notes && <p className="mt-1 text-xs italic text-neutral-400">{notes}</p>}
    </div>
  );
}
