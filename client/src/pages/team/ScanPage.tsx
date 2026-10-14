import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScanLine, Smartphone, KeyRound, CheckCircle2 } from "lucide-react";
import { api } from "@/api/client";
import { QrScanner } from "@/components/QrScanner";
import { Alert } from "@/components/Alert";
import { extractToken } from "@/utils/qr";
import { errorMessage, type SkipResult } from "@/api/types";

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

      <SkipPanel />
    </div>
  );
}

/**
 * Allows the team to skip its current posta when the QR cannot be scanned.
 * The skip is authorized with the rescue phrase dictated by the coordinators.
 */
function SkipPanel() {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SkipResult | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<SkipResult>("/api/v1/visits/skip", { phrase, reason });
      setResult(res);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (result?.result === "SKIPPED") {
    return (
      <section className="card border-amber-300 bg-amber-50">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
          <div>
            <h2 className="font-display text-base font-bold text-amber-900">
              Posta {result.skippedStation.position} saltada
            </h2>
            {result.nextStation ? (
              <p className="text-sm font-semibold text-amber-800">
                Siguiente parada ({result.nextStation.position}):{" "}
                <span className="font-extrabold">{result.nextStation.name}</span>. Solo faltan{" "}
                {result.remaining} posta{result.remaining === 1 ? "" : "s"}.
              </p>
            ) : (
              <p className="text-sm font-semibold text-amber-800">
                Terminaste el recorrido completo.
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
      >
        <KeyRound className="h-6 w-6 shrink-0 text-clay-600" />
        <div className="flex-1">
          <h2 className="font-display text-base font-bold text-forest-900">
            No puedo escanear el QR
          </h2>
          <p className="text-sm font-semibold text-forest-600">
            Si falta el código, pedí la frase de rescate a la organización.
          </p>
        </div>
      </button>

      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
          <div>
            <label htmlFor="rescue" className="label">
              Frase de rescate
            </label>
            <input
              id="rescue"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              className="input"
              placeholder="Escribila tal como te la dictaron"
              autoComplete="off"
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="reason" className="label">
              ¿Qué pasó? (opcional)
            </label>
            <input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input"
              placeholder="Ej: el cartel estaba roto"
              disabled={submitting}
            />
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          <button type="submit" disabled={submitting || !phrase.trim()} className="btn-orange w-full">
            {submitting ? "Verificando…" : "Saltar esta posta"}
          </button>
        </form>
      )}
    </section>
  );
}