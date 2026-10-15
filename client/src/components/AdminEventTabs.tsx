import { NavLink } from "react-router-dom";
import {
  Compass,
  Route,
  Printer,
  LayoutDashboard,
  Binoculars,
  ListChecks,
  Trophy,
  Users,
  MapPin,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Tab = { to: string; label: string; icon: LucideIcon };
type Group = { label: string; tabs: Tab[] };

// Agrupación del nav de evento. En escritorio se muestra como barra lateral
// vertical (dentro de AdminShelter); en mobile, como bloques horizontales.
// "Equipos y puntaje" contiene las sub-pestañas Equipos | Ranking.
const groups: Group[] = [
  {
    label: "Resumen",
    tabs: [{ to: "pizarra", label: "Pizarra", icon: LayoutDashboard }],
  },
  {
    label: "Participantes",
    tabs: [
      { to: "equipos", label: "Equipos y puntaje", icon: Compass },
      { to: "integrantes", label: "Integrantes", icon: Users },
    ],
  },
  {
    label: "Recorrido",
    tabs: [
      { to: "postas", label: "Postas", icon: MapPin },
      { to: "itinerarios", label: "Itinerarios", icon: Route },
      { to: "impresion", label: "QR / Imprimir", icon: Printer },
    ],
  },
  {
    label: "Puntuación",
    tabs: [
      { to: "actividades", label: "Actividades", icon: ListChecks },
      { to: "safari", label: "Safari", icon: Binoculars },
      { to: "resultados", label: "Resultados", icon: Trophy },
    ],
  },
];

export function AdminEventTabs({
  eventId,
  variant = "horizontal",
}: {
  eventId: string;
  variant?: "horizontal" | "vertical";
}) {
  if (variant === "vertical") {
    return (
      <nav className="space-y-4">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-2 text-xs font-bold uppercase tracking-wider text-forest-400">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.tabs.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={`/admin/eventos/${eventId}/${to}`}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                      isActive ? "bg-forest-700 text-white" : "text-forest-700 hover:bg-white"
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav className="mb-5 space-y-3">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-1 text-xs font-bold uppercase tracking-wider text-forest-400">
            {group.label}
          </p>
          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4">
            {group.tabs.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={`/admin/eventos/${eventId}/${to}`}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                    isActive ? "bg-forest-700 text-white" : "bg-white text-forest-700 hover:bg-forest-50"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
