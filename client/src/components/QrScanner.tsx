import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";

type Props = {
  onDecode: (text: string) => void;
};

type ScannerStatus = "starting" | "scanning" | "camera-denied" | "error" | "stopped";

export function QrScanner({ onDecode }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [status, setStatus] = useState<ScannerStatus>("starting");

  useEffect(() => {
    let cancelled = false;
    const reader = new BrowserQRCodeReader();

    reader
      .decodeFromVideoDevice(
        "environment",
        videoRef.current!,
        (result, _error, controls) => {
          if (cancelled) return;
          if (result && result.getText()) {
            controls.stop();
            setStatus("stopped");
            onDecode(result.getText());
          }
        }
      )
      .then((controls) => {
        controlsRef.current = controls;
        if (!cancelled) setStatus("scanning");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const name = (err as { name?: string })?.name ?? "";
        if (
          name === "NotAllowedError" ||
          name === "PermissionDeniedError" ||
          (err as Error).message?.includes("permission")
        ) {
          setStatus("camera-denied");
        } else {
          setStatus("error");
        }
      });

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
          No se pudo iniciar el escáner. Usá la cámara nativa del teléfono (la
          app de fotos lee códigos QR automáticamente) y recordá que en
          producción el acceso a cámara requiere HTTPS.
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