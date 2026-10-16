import { Instagram } from "lucide-react";

export const SCOUT_INSTAGRAM_URL = "https://www.instagram.com/gruposcout62/";
export const SCOUT_INSTAGRAM_HANDLE = "@gruposcout62";

/**
 * Shown when a station QR is scanned but the event is no longer open
 * (finished or cancelled): invites players to follow the scout group.
 */
export function ScoutInvite({ eventName }: { eventName?: string }) {
  return (
    <div className="card flex flex-col items-center gap-5 py-10 text-center">
      <img
        src="/logo-62.png"
        alt="Grupo Scout 62 Ypacaraí"
        className="h-32 w-32 rounded-3xl bg-white object-contain shadow-sm ring-1 ring-beige-200"
      />
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-forest-900">¡Ven a conocernos!</h1>
        <p className="font-semibold text-forest-600">Somos el Grupo Scout 62 Ypacaraí.</p>
        {eventName && (
          <p className="text-sm font-semibold text-forest-500">
            Gracias por participar de {eventName}.
          </p>
        )}
      </div>
      <a href={SCOUT_INSTAGRAM_URL} target="_blank" rel="noreferrer" className="btn-primary">
        <Instagram className="h-5 w-5" /> Seguinos en Instagram
      </a>
      <p className="font-mono text-xs text-forest-400">{SCOUT_INSTAGRAM_HANDLE}</p>
    </div>
  );
}
