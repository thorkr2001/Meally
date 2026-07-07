const BLOB_RADIUS = "50% 50% 50% 50% / 65% 65% 35% 35%";

export function FlameIcon({ size = 14 }: { size?: number }) {
  const height = Math.round(size * 1.2);
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height }}>
      <span className="absolute inset-0 rotate-3 bg-flame" style={{ borderRadius: BLOB_RADIUS }} />
      <span
        className="absolute bg-flame-light"
        style={{
          left: size * 0.2,
          top: height * 0.28,
          width: size * 0.58,
          height: height * 0.55,
          borderRadius: BLOB_RADIUS,
        }}
      />
    </span>
  );
}
