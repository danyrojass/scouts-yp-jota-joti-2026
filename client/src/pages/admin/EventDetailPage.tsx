import { useCallback } from "react";
import { useParams, Link, Outlet } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AdminEventTabs } from "@/components/AdminEventTabs";
import { useApi } from "@/hooks/useApi";
import { api } from "@/api/client";
import type { EventItem } from "@/api/types";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Alert } from "@/components/Alert";

export function EventDetailPage() {
  const { eventId = "" } = useParams();
  const fetchEvent = useCallback(() => api.get<{ event: EventItem }>(`/api/v1/events/${eventId}`).then((r) => r.event), [eventId]);
  const { data: event, loading, error } = useApi<EventItem>(fetchEvent, [eventId]);

  if (loading && !event) return <LoadingScreen label="Cargando evento…" />;
  if (error && !event) return <Alert tone="error">{error}</Alert>;

  return (
    <div className="min-w-0">
      <Link to="/admin/eventos" className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-forest-600 hover:text-forest-800">
        <ArrowLeft className="h-4 w-4" /> Volver a eventos
      </Link>
      {event && (
        <>
          <h1 className="mb-1 font-display text-2xl font-bold text-forest-900">{event.name}</h1>
          <p className="mb-4 text-sm font-semibold text-forest-600">
            📅 {new Date(event.date).toLocaleDateString("es")}
            {event.location ? ` • 📍 ${event.location}` : ""}
          </p>
          <AdminEventTabs eventId={eventId} />
        </>
      )}
      <Outlet />
    </div>
  );
}