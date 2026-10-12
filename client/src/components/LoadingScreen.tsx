import { Logo } from "./Logo";

export function LoadingScreen({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-forest-100 p-6 text-center">
      <Logo size={64} />
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-forest-200 border-t-clay-500" />
      <p className="font-bold text-forest-800">{label}</p>
    </div>
  );
}