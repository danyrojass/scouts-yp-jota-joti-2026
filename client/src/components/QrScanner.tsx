import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";

type Props = {
  onDecode: (text: string) => void;
};

type ScannerStatus = "starting" | "scanning" | "camera-denied" | "error" | "stopped";

// Orden de intentos: cámara trasera (ideal, sin fallar si no existe), trasera
// estricta y, como último recurso, cualquier cámara. Evita el bug de
// `decodeFromVideoDevice("environment")`, que trata ese string como deviceId.
const CONSTRAINT_FALLBACKS: MediaStreamConstraints[] = [
  { video: { facingMode: { ideal: "environment" } } },
  { video: { facingMode: "environment" } },
  { video: true },
];

export function QrScanner({ onDecode }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [status, setStatus] = useState<ScannerStatus>("starting");

  useEffect(() => {
    let cancelled = false;
    const reader = new BrowserQRCodeReader();

    const isPermissionError = (err: unknown) => {
      const name = (err as { name?: string })?.name ?? "";
      const message = (err as Error)?.message?.toLowerCase() ?? "";
      return (
        name === "NotAllowedError" ||
        name === "PermissionDeniedError" ||
        name === "SecurityError" ||
        message.includes("permission")
      );
    };

    const start = async () => {
      for (const constraints of CONSTRAINT_FALLBACKS) {
        if (cancelled) return;
        try {
          const controls = await reader.decodeFromConstraints(
            constraints,
            videoRef.current!,
            (result, _error, ctrls) => {
              if (cancelled) return;
              if (result && result.getText()) {
                ctrls.stop();
                setStatus("stopped");
                onDecode(result.getText());
              }
            }
          );
          if (cancelled) {
            controls.stop();
            return;
          }
          controlsRef.current = controls;
          setStatus("scanning");
          return;
        } catch (err) {
          if (cancelled) return;
          // Permiso denegado: no tiene sentido seguir probando variantes.
          if (isPermissionError(err)) {
            setStatus("camera-denied");
            return;
          }
          // Otro error (p.ej. la cámara pedida no existe): probamos la siguiente.
        }
      }
      if (!cancelled) setStatus("error");
    };

    void start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [onDecode]);

  return (
    <div className="overflow-hidden rounded-3xl bg-forest-950">
      <video
        ref={videoRef}
        className="aspect-square w-full object-cover"
        muted
        playsInline
      />
      {status === "starting" && (
        <div className="flex items-center justify-center gap-2 bg-forest-950 p-6 text-sm font-bold text-white">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-clay-400" />
          Solicitando permiso de cámara…
        </div>
      )}
      {status === "camera-denied" && (
        <div className="bg-clay-50 p-5 text-sm font-bold text-clay-800">
          No podemos acceder a la cámara del teléfono. Aceptá el permiso en tu
          navegador o usá la cámara nativa para escanear el QR impreso.
        </div>
      )}
      {status === "error" && (
        <div className="bg-red-50 p-5 text-sm font-bold text-red-800">
          No se pudo iniciar el escáner en este dispositivo. Cerrá otras apps que
          usen la cámara, recargá la página y volvé a intentar. Si sigue fallando,
          usá la cámara nativa del teléfono (la app de fotos lee códigos QR).
        </div>
      )}
      {status === "scanning" && (
        <p className="bg-forest-900 py-2 text-center text-xs font-bold text-beige-200">
          Apuntá al código QR de la posta
        </p>
      )}
    </div>
  );
}