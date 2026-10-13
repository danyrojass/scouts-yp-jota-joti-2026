import { Navigate, Outlet, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Logo } from "@/components/Logo";

export function AdminShelter() {
  const { status, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  if (status === "loading") return <LoadingScreen />;
  if (!isAdmin) return <Navigate to={status === "anon" ? "/login" : "/pasaporte"} replace />;

  const sections = [
    { to: "/admin", label: "Inicio", icon: LayoutDashboard, end: true },
  ];

  return (
    <div className="min-h-dvh bg-forest-100">
      <header className="sticky top-0 z-20 border-b border-beige-200 bg-white shadow-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="rounded-xl p-2 text-forest-600 hover:bg-forest-50" title="Atrás" aria-label="Atrás">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <Logo size={32} />
              <div className="leading-tight">
                <p className="font-display text-lg font-bold text-forest-900">Panel del Organizador</p>
                <p className="text-xs font-semibold uppercase tracking-widest text-clay-600">JOTA-JOTI 2026 Ypacaraí</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => void logout()}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-forest-700 hover:bg-forest-50"
          >
            <LogOut className="h-4 w-4" />
            Salir
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24 space-y-1">
            {sections.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-colors ${
                    isActive ? "bg-forest-700 text-white" : "text-forest-700 hover:bg-white"
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                {label}
              </NavLink>
            ))}
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}