import { Navigate, Outlet, NavLink, useLocation } from "react-router-dom";
import { Compass, Map, Camera, LogOut, Binoculars, Trophy } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Logo } from "@/components/Logo";

const navItems = [
  { to: "/pasaporte", label: "Pasaporte", icon: Compass },
  { to: "/escanear", label: "Escanear", icon: Camera },
  { to: "/itinerario", label: "Ruta", icon: Map },
  { to: "/safari", label: "Safari", icon: Binoculars },
  { to: "/ranking", label: "Ranking", icon: Trophy },
];

export function TeamShelter() {
  const { status, isTeam, principal, logout } = useAuth();
  const location = useLocation();

  if (status === "loading") return <LoadingScreen />;
  if (!isTeam) {
    // La posta es accesible sin sesión: tras el evento muestra la invitación al
    // grupo y durante el evento pide iniciar sesión (ver StationPage).
    if (location.pathname.startsWith("/posta/")) {
      return (
        <div className="min-h-dvh bg-forest-100">
          <main className="mx-auto max-w-2xl px-4 py-5">
            <Outlet />
          </main>
        </div>
      );
    }
    return (
      <Navigate to={status === "anon" ? `/login?next=${encodeURIComponent(location.pathname)}` : "/admin"} replace />
    );
  }

  const team = principal?.type === "team" ? principal.team : null;

  return (
    <div className="min-h-dvh bg-forest-100 pb-24">
      <header className="sticky top-0 z-20 border-b border-beige-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Logo size={36} />
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-lg font-bold text-forest-900">
                {team?.name}
              </p>
              <p className="truncate text-xs font-semibold text-forest-600">
                Equipo explorador
              </p>
            </div>
          </div>
          <button
            onClick={() => void logout()}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-forest-700 hover:bg-forest-50"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
            Salir
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-beige-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/pasaporte"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold transition-colors ${
                  isActive ? "text-clay-600" : "text-forest-500 hover:text-forest-700"
                }`
              }
            >
              <Icon className="h-6 w-6" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}