export function Logo({ size = 44 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="22" fill="#33663a" />
      <circle cx="24" cy="24" r="15" fill="#f2ecda" />
      <path
        d="M24 14v12l8 5"
        stroke="#ec8b2d"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="24" r="4" fill="#1f3d28" />
      <path
        d="M24 9v8M24 31v8M9 24h8M31 24h8"
        stroke="#faf7f0"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Logo />
      <div className="leading-tight">
        <p className="font-display text-xl font-bold text-forest-900">
          Exploración de Ypacaraí
        </p>
        {!compact && (
          <p className="text-xs font-semibold uppercase tracking-widest text-clay-600">
            Aventura de orientación
          </p>
        )}
      </div>
    </div>
  );
}