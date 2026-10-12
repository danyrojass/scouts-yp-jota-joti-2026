import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScanLine, Smartphone } from "lucide-react";
import { QrScanner } from "@/components/QrScanner";
import { Alert } from "@/components/Alert";
import { extractToken } from "@/utils/qr";

export function ScanPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [scannerKey, setScannerKey] = useState(0);

  const handleDecode = (text: string) => {
    const token = extractToken(text);
    if (!token) {
      setError("El código escaneado no pertenece a esta actividad.");
      setScanning(true);
      setScannerKey((k) => k + 1);
      return;
    }
    navigate(`/posta/${token}`);
  };

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="mb-3 flex items-center gap-3">
          <ScanLine className="h-8 w-8 text-clay-600" />
          <div>
            <h1 className="font-display text-2xl font-bold text-forest-900">Escanear posta</h1>
            <p className="text-sm font-semibold text-forest-600">
              Apuntá la cámara al código QR que está en la posta.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-3">
            <Alert tone="error">{error}</Alert>
          </div>
        )}

        {scanning ? (
          <>
            <QrScanner
              key={scannerKey}
              onDecode={(text) => {
                setScanning(false);
                handleDecode(text);
              }}
            />
            <button
              onClick={() => setScannerKey((k) => k + 1)}
              className="btn-secondary mt-3 w-full"
            >
              Reiniciar escáner
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-forest-200 border-t-clay-500" />
            <p className="font-bold text-forest-700">Abriendo la posta…</p>
          </div>
        )}
      </section>

      <section className="card">
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 h-6 w-6 shrink-0 text-forest-600" />
          <div>
            <h2 className="font-display text-base font-bold text-forest-900">
              ¿La cámara no funciona?
            </h2>
            <p className="text-sm font-semibold text-forest-600">
              Podés usar la cámara nativa de tu teléfono: abrí la aplicación de
              fotos y apuntá al QR. Se abrirá un enlace a la posta automáticamente.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}