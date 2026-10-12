import { NavLink } from "react-router-dom";
import { CalendarDays, Compass, Route, Printer, Download, LayoutDashboard, Binoculars } from "lucide-react";

const tabs = [
  { to: "pizarra", label: "Pizarra", icon: LayoutDashboard },
  { to: "equipos", label: "Equipos", icon: Compass },
  { to: "postas", label: "Postas", icon: CalendarDays },
  { to: "itinerarios", label: "Itinerarios", icon: Route },
  { to: "safari", label: "Safari", icon: Binoculars },
  { to: "impresion", label: "QR / Imprimir", icon: Printer },
  { to: "resultados", label: "Resultados", icon: Download },
];

export function AdminEventTabs({ eventId }: { eventId: string }) {
  return (
    <nav className="scrollbar-none -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
      {tabs.map(({ to, label, icon: Icon }) => (
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
    </nav>
  );
}