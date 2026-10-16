import type { ReactNode } from "react";
import { CheckCircle2, Route as RouteIcon, XCircle } from "lucide-react";

const TONE_ICON = {
  error: <XCircle className="h-10 w-10 text-red-500" />,
  info: <CheckCircle2 className="h-10 w-10 text-forest-600" />,
  warning: <RouteIcon className="h-10 w-10 text-clay-500" />,
};

/** Centered card used for terminal states (errors, completion, messages). */
export function MessageScreen({
  tone,
  title,
  icon,
  children,
}: {
  tone: "error" | "info" | "warning";
  title: string;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 py-10 text-center">
      {icon ?? TONE_ICON[tone]}
      <h1 className="font-display text-xl font-bold text-forest-900">{title}</h1>
      <div className="flex flex-col items-center gap-2">{children}</div>
    </div>
  );
}
