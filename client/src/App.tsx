import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LoadingScreen } from "@/components/LoadingScreen";
import { LoginPage } from "@/pages/LoginPage";
import { TeamShelter } from "@/components/TeamShelter";
import { AdminShelter } from "@/components/AdminShelter";
import { PassportPage } from "@/pages/team/PassportPage";
import { ItineraryPage } from "@/pages/team/ItineraryPage";
import { SafariPage } from "@/pages/team/SafariPage";
import { StationPage } from "@/pages/team/StationPage";
import { AdminHome } from "@/pages/admin/AdminHome";
import { EventsPage } from "@/pages/admin/EventsPage";
import { EventDetailPage } from "@/pages/admin/EventDetailPage";
import { DashboardPage } from "@/pages/admin/DashboardPage";
import { TeamsPage } from "@/pages/admin/TeamsPage";
import { StationsPage } from "@/pages/admin/StationsPage";
import { ItinerariesPage } from "@/pages/admin/ItinerariesPage";
import { SafariAdminPage } from "@/pages/admin/SafariPage";
import { PrintQrsPage } from "@/pages/admin/PrintQrsPage";
import { ResultsPage } from "@/pages/admin/ResultsPage";

// El escáner de QR (librería @zxing) se carga solo al abrir esta pantalla.
const ScanPage = lazy(() =>
  import("@/pages/team/ScanPage").then((m) => ({ default: m.ScanPage }))
);

function HomeRedirect() {
  const { status, isAdmin, isTeam } = useAuth();
  if (status === "loading") return <LoadingScreen />;
  if (isTeam) return <Navigate to="/pasaporte" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<TeamShelter />}>
        <Route path="/pasaporte" element={<PassportPage />} />
        <Route path="/itinerario" element={<ItineraryPage />} />
        <Route path="/safari" element={<SafariPage />} />
        <Route
          path="/escanear"
          element={
            <Suspense fallback={<LoadingScreen />}>
              <ScanPage />
            </Suspense>
          }
        />
        <Route path="/posta/:token" element={<StationPage />} />
      </Route>

      <Route path="/admin" element={<AdminShelter />}>
        <Route index element={<AdminHome />} />
        <Route path="eventos" element={<EventsPage />} />
        <Route path="eventos/:eventId" element={<EventDetailPage />}>
          <Route index element={<Navigate to="pizarra" replace />} />
          <Route path="pizarra" element={<DashboardPage />} />
          <Route path="equipos" element={<TeamsPage />} />
          <Route path="postas" element={<StationsPage />} />
          <Route path="itinerarios" element={<ItinerariesPage />} />
          <Route path="safari" element={<SafariAdminPage />} />
          <Route path="impresion" element={<PrintQrsPage />} />
          <Route path="resultados" element={<ResultsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}