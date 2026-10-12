/**
 * Extracts the station token from a scanned QR payload. The QR points to a
 * URL like https://dominio/posta/TOKEN. If the URL is not for this app (or is
 * malformed) we still try the last path segment as a token.
 */
export function extractToken(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      const match = url.pathname.match(/^\/posta\/([A-Za-z0-9_-]+)\/?$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
  const match = trimmed.match(/^[A-Za-z0-9_-]{8,64}$/);
  return match ? trimmed : null;
}