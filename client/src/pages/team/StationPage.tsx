import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MapPin, CheckCircle2, XCircle, Route as RouteIcon, RotateCcw, ScanLine } from "lucide-react";
import { api } from "@/api/client";
import {
  errorMessage,
  type StationChallengeResponse,
  type VisitResult,
} from "@/api/types";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Alert } from "@/components/Alert";

const answerSchema = z.object({
  answer: z.string().trim().min(1, "Ingresá una respuesta"),
});

const NEXT_STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Esta posta ya fue completada",
  NOT_YOUR_NEXT: "Esta no es tu próxima posta. Consultá el itinerario de tu equipo.",
  EVENT_NOT_READY: "El evento todavía no comenzó.",
  EVENT_FINISHED: "El evento ya finalizó.",
  EVENT_CANCELLED: "El evento fue cancelado.",
  INACTIVE: "Esta posta está desactivada.",
  WRONG_EVENT: "Esta posta no pertenece a tu evento.",
};

export function StationPage() {
  const { token = "" } = useParams();
  const [challenge, setChallenge] = useState<StationChallengeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VisitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<{ answer: string }>({ resolver: zodResolver(answerSchema) });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    reset();
    try {
      setChallenge(await api.get<StationChallengeResponse>(`/api/v1/visits/posta/${token}`));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token, reset]);

  useEffect(() => {
    void load();
  }, [load]);

  const needsAnswer = challenge?.status === "NEXT" && challenge.station.challengeType !== "CONFIRMATION";

  const onSubmit = async ({ answer }: { answer: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<VisitResult>("/api/v1/visits", {
        publicToken: token,
        answer,
      });
      setResult(res);
      if (res.result === "VALID") {
        // The passport page will poll and reflect the new progress.
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingScreen label="Abriendo la posta…" />;

  if (error && !challenge) return <MessageScreen tone="error" title="No se pudo abrir la posta"><span>{error}</span></MessageScreen>;

  if (!challenge) return null;

  if (challenge.status !== "NEXT") {
    const isCompleted = challenge.status === "COMPLETED";
    return (
      <MessageScreen
        tone={isCompleted ? "info" : "warning"}
        title={NEXT_STATUS_LABEL[challenge.status] ?? "Posta no disponible"}
      >
        {challenge.status === "NOT_YOUR_NEXT" && (
          <Link to="/itinerario" className="btn-primary mt-1">
            <RouteIcon className="h-5 w-5" /> Ver mi itinerario
          </Link>
        )}
        {challenge.status === "COMPLETED" && (
          <Link to="/pasaporte" className="btn-secondary mt-1">
            <CheckCircle2 className="h-5 w-5" /> Ir al pasaporte
          </Link>
        )}
      </MessageScreen>
    );
  }

  const station = challenge.station;

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-clay-600">
          <MapPin className="h-4 w-4" /> Posta del recorrido
        </div>
        <h1 className="font-display text-2xl font-bold text-forest-900">{station.name}</h1>
        {station.description && (
          <p className="mt-1 text-sm font-semibold text-forest-600">{station.description}</p>
        )}
      </section>

      {result?.result === "VALID" && (
        <Alert tone="success">
          <p className="font-extrabold">¡Posta completada!</p>
          {result.nextStation ? (
            <p>
              Siguiente parada ({result.nextStation.position}):{" "}
              <span className="font-extrabold">{result.nextStation.name}</span>. Solo faltan{" "}
              {result.remaining} posta{result.remaining === 1 ? "" : "s"}.
            </p>
          ) : (
            <p>¡Terminaste el recorrido completo!</p>
          )}
        </Alert>
      )}

      {result?.result === "INCORRECT" && (
        <Alert tone="error">
          <p>Respuesta incorrecta (intento {result.attemptNumber}). Volvé a intentarlo.</p>
        </Alert>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      <section className="card">
        {station.instructions && (
          <h2 className="mb-3 font-display text-lg font-bold text-forest-900">Consigna</h2>
        )}
        {station.instructions && (
          <p className="mb-4 whitespace-pre-line rounded-2xl bg-beige-50 p-4 text-sm font-semibold text-forest-800">
            {station.instructions}
          </p>
        )}
        {station.displayedCode && (
          <div className="mb-4 rounded-2xl bg-clay-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-clay-600">Pista visible</p>
            <p className="mt-0.5 font-bold text-clay-800">{station.displayedCode}</p>
          </div>
        )}

        {needsAnswer ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
            <div>
              <label htmlFor="answer" className="label">
                Tu respuesta
              </label>
              <input
                id="answer"
                {...register("answer")}
                className="input"
                placeholder="Escribí acá…"
                autoFocus
                disabled={submitting}
              />
              {errors.answer && (
                <p className="mt-1 text-sm font-semibold text-red-600">{errors.answer.message}</p>
              )}
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? "Verificando…" : "Registrar respuesta"}
            </button>
          </form>
        ) : (
          <button
            onClick={() => void onSubmit({ answer: "confirmacion" })}
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting ? "Registrando…" : "Confirmar mi paso por esta posta"}
          </button>
        )}
      </section>

      {result?.result === "VALID" && (
        <button onClick={() => { setResult(null); void load(); }} className="btn-secondary w-full">
          <ScanLine className="h-5 w-5" /> Registrar otra posta
        </button>
      )}
      {result?.result === "INCORRECT" && (
        <button
          onClick={() => { setResult(null); reset(); }}
          className="btn-secondary w-full"
        >
          <RotateCcw className="h-5 w-5" /> Intentar de nuevo
        </button>
      )}
    </div>
  );
}

function MessageScreen({
  tone,
  title,
  children,
}: {
  tone: "error" | "info" | "warning";
  title: string;
  children?: React.ReactNode;
}) {
  const icon =
    tone === "error" ? <XCircle className="h-10 w-10 text-red-500" /> : tone === "info" ? <CheckCircle2 className="h-10 w-10 text-forest-600" /> : <RouteIcon className="h-10 w-10 text-clay-500" />;
  return (
    <div className="card flex flex-col items-center gap-2 py-10 text-center">
      {icon}
      <h1 className="font-display text-xl font-bold text-forest-900">{title}</h1>
      <div className="flex flex-col items-center gap-2">{children}</div>
    </div>
  );
}