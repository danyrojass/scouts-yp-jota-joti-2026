import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/api/types";
import { Logo } from "@/components/Logo";
import { Alert } from "@/components/Alert";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Compass, Eye, EyeOff } from "lucide-react";

const schema = z.object({
  username: z.string().trim().min(2, "Usuario requerido"),
  password: z.string().min(1, "Contraseña requerida"),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { status, isAdmin, isTeam, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const params = new URLSearchParams(location.search);
  const next = params.get("next") ?? "";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (status === "auth") {
    return <Navigate to={isTeam ? "/pasaporte" : isAdmin ? "/admin" : "/login"} replace />;
  }
  if (status === "loading") return <LoadingScreen />;

  const onSubmit = async (values: FormValues) => {
    try {
      await login(values.username, values.password);
      const target = next.startsWith("/") && !next.startsWith("//") ? next : undefined;
      navigate(target ?? (isTeam ? "/pasaporte" : "/admin"), { replace: true });
    } catch (err) {
      setError("root", { message: errorMessage(err, "No se pudo iniciar sesión") });
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-forest-800 to-forest-950 p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo size={72} />
          <div>
            <h1 className="font-display text-3xl font-bold text-white">
              Exploración de Ypacaraí
            </h1>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-beige-300">
              <Compass className="h-4 w-4" />
              Orientación • Postas • Aventura
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="card space-y-4 shadow-lift"
          noValidate
        >
          <h2 className="font-display text-xl font-bold text-forest-900">Iniciar sesión</h2>

          {errors.root && <Alert tone="error">{errors.root.message}</Alert>}

          <div>
            <label htmlFor="username" className="label">Equipo o usuario</label>
            <input
              id="username"
              {...register("username")}
              className="input"
              placeholder="p. ej. aguara"
              autoComplete="username"
              autoFocus
            />
            {errors.username && <p className="mt-1 text-sm font-semibold text-red-600">{errors.username.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="label">Contraseña</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                {...register("password")}
                className="input pr-11"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-forest-500 hover:text-forest-700"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-sm font-semibold text-red-600">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? "Ingresando…" : "Comenzar aventura"}
          </button>

          <p className="text-center text-xs font-semibold text-forest-500">
            Las credenciales son entregadas por la organización del evento.
          </p>
        </form>
      </div>
    </div>
  );
}