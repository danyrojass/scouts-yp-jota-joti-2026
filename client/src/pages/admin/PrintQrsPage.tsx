import { useCallback } from "react";
import { useParams } from "react-router-dom";
import { Printer, Link2 } from "lucide-react";
import { api } from "@/api/client";
import type { StationItem } from "@/api/types";
import { useApi } from "@/hooks/useApi";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Alert } from "@/components/Alert";

const QR_BASE = (import.meta.env.VITE_API_URL || "") + "/api/v1/stations";

export function PrintQrsPage() {
  const { eventId = "" } = useParams();
  const fetchStations = useCallback(() => api.get<{ stations: StationItem[] }>(`/api/v1/stations?eventId=${eventId}`).then((r) => r.stations), [eventId]);
  const { data: stations, loading, error } = useApi<StationItem[]>(fetchStations, [eventId]);

  if (loading && !stations) return <LoadingScreen label="Cargando postas…" />;
  if (error && !stations) return <Alert tone="error">{error}</Alert>;

  const print = () => window.print();

  return (
    <div className="space-y-4 print:space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="font-display text-xl font-bold text-forest-900">QR para imprimir</h2>
          <p className="text-sm font-semibold text-forest-600">
            Se imprimen dos carteles por hoja. Recortá cada uno y colocalo en el punto indicado.
          </p>
        </div>
        <button onClick={print} className="btn-primary">
          <Printer className="h-5 w-5" /> Imprimir carteles
        </button>
      </div>

      <div className="card flex items-start gap-3 text-sm print:hidden">
        <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-clay-600" />
        <p className="font-semibold text-forest-600">
          Cada QR abre la URL pública de la posta en el navegador del teléfono
          (configurada con <span className="font-mono">PUBLIC_BASE_URL</span> en el servidor). La
          misma puede imprimirse como PNG desde el botón "QR" de cada posta. En
          producción, el acceso a la cámara requiere HTTPS.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-1 print:gap-2">
        {stations?.map((s) => (
          <div key={s.id} className="card flex flex-col items-center gap-3 text-center break-inside-avoid print:gap-2 print:p-4">
            <p className="font-display text-xl font-bold text-forest-900">{s.name}</p>
            <img
              src={`${QR_BASE}/${s.id}/qr`}
              alt={`Código QR de ${s.name}`}
              className="w-full max-w-[28rem] rounded-2xl border border-beige-200 bg-white p-2 print:max-w-[24rem]"
            />
            <p className="font-mono text-xs text-forest-500">{s.challengeType}</p>
          </div>
        ))}
      </div>

      <style>{`
        @page { margin: 10mm; }
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:space-y-0 > * { margin: 0 !important; }
        }
      `}</style>
    </div>
  );
}