import { CheckCircle2, AlertCircle, Info, XCircle } from "lucide-react";

type Tone = "success" | "error" | "info" | "warning";

const styles: Record<Tone, { box: string; icon: React.ReactNode }> = {
  success: {
    box: "border-forest-300 bg-forest-50 text-forest-900",
    icon: <CheckCircle2 className="h-5 w-5 shrink-0 text-forest-600" />,
  },
  error: {
    box: "border-red-300 bg-red-50 text-red-900",
    icon: <XCircle className="h-5 w-5 shrink-0 text-red-600" />,
  },
  info: {
    box: "border-sky-300 bg-sky-50 text-sky-900",
    icon: <Info className="h-5 w-5 shrink-0 text-sky-600" />,
  },
  warning: {
    box: "border-clay-400 bg-amber-50 text-amber-900",
    icon: <AlertCircle className="h-5 w-5 shrink-0 text-clay-600" />,
  },
};

export function Alert({
  tone = "info",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  const s = styles[tone];
  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm font-semibold ${s.box}`}
    >
      {s.icon}
      <div className="min-w-0">{children}</div>
    </div>
  );
}