export function WeightChart({ logs }: { logs: { weightKg: number; loggedAt: Date }[] }) {
  if (logs.length < 2) {
    return (
      <p className="text-sm text-neutral-400">Log your weight a few more times to see your trend.</p>
    );
  }

  const width = 320;
  const height = 120;
  const padding = 16;

  const weights = logs.map((l) => l.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  const points = logs.map((log, i) => {
    const x = padding + (i / (logs.length - 1)) * (width - padding * 2);
    const y = height - padding - ((log.weightKg - min) / range) * (height - padding * 2);
    return { x, y, ...log };
  });

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full max-w-sm">
      <path d={path} fill="none" stroke="#2a78d6" className="dark:stroke-[#3987e5]" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 4 : 3} fill="#2a78d6" className="dark:fill-[#3987e5]">
          <title>
            {p.loggedAt.toLocaleDateString()}: {p.weightKg} kg
          </title>
        </circle>
      ))}
      <text x={points[0].x} y={points[0].y - 8} fontSize="10" fill="#898781" textAnchor="start">
        {points[0].weightKg}kg
      </text>
      <text
        x={points[points.length - 1].x}
        y={points[points.length - 1].y - 8}
        fontSize="10"
        fill="#0b0b0b"
        className="dark:fill-white"
        textAnchor="end"
        fontWeight="600"
      >
        {points[points.length - 1].weightKg}kg
      </text>
    </svg>
  );
}
