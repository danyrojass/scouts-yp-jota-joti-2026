export function ProgressBar({
  value,
  max,
  className = "",
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={`h-3 w-full overflow-hidden rounded-full bg-beige-200 ${className}`}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-forest-500 to-clay-500 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Badge({
  children,
  tone = "forest",
}: {
  children: React.ReactNode;
  tone?: "forest" | "orange" | "red" | "gray" | "green" | "beige";
}) {
  const tones: Record<string, string> = {
    forest: "bg-forest-100 text-forest-800",
    orange: "bg-clay-100 text-clay-700",
    red: "bg-red-100 text-red-700",
    green: "bg-emerald-100 text-emerald-700",
    gray: "bg-gray-100 text-gray-600",
    beige: "bg-beige-100 text-beige-900",
  };
  return <span className={`badge ${tones[tone]}`}>{children}</span>;
}