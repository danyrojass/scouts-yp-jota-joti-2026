import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LogIn, ScanLine } from "lucide-react";
import { api } from "@/api/client";
import { errorMessage } from "@/api/types";
import { LoadingScreen } from "@/components/LoadingScreen";
import { MessageScreen } from "@/components/MessageScreen";
import { ScoutInvite } from "@/components/ScoutInvite";

type PublicTokenStatus = "OPEN" | "CLOSED" | "NOT_FOUND";

/**
 * View for visitors who scan a station QR **without** a team session. It asks
 * the server for the token's coarse status and then:
 * - `OPEN`: invites the visitor to log in with their team account.
 * - `CLOSED` (event finished/cancelled): shows the scout group invitation.
 * - `NOT_FOUND`: the QR does not belong to a station.
 */
export function PublicStationView({ token }: { token: string }) {
  const [status, setStatus] = useState<PublicTokenStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<{ status: PublicTokenStatus }>(
        `/api/v1/stations/public/${token}`
      );
      setStatus(res.status);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <MessageScreen tone="error" title="No se pudo abrir la posta">
        <span>{error}</span>
      </MessageScreen>
    );
  }

  if (!status) return <LoadingScreen label="Abriendo la posta…" />;

  if (status === "CLOSED") return <ScoutInvite />;

  if (status === "NOT_FOUND") {
    return (
      <MessageScreen tone="error" title="Código QR inválido">
        <span>Este código no corresponde a una posta del evento.</span>
      </MessageScreen>
    );
  }

  return (
    <MessageScreen
      tone="info"
      title="Iniciá sesión para participar"
      icon={<ScanLine className="h-10 w-10 text-forest-600" />}
    >
      <span>
        Escaneá con la cuenta de tu equipo para registrar tu paso por esta posta.
      </span>
      <Link
        to={`/login?next=${encodeURIComponent(`/posta/${token}`)}`}
        className="btn-primary mt-1"
      >
        <LogIn className="h-5 w-5" /> Iniciar sesión
      </Link>
    </MessageScreen>
  );
}
