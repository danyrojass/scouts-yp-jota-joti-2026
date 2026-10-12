import { describe, it, expect } from "vitest";
import { extractToken } from "@/utils/qr";

describe("extractToken", () => {
  it("extrae el token de una URL pública de posta", () => {
    expect(extractToken("https://dominio.com/posta/abc123-_-XYZ")).toBe("abc123-_-XYZ");
    expect(extractToken("https://dominio.com/posta/TOKEN/")).toBe("TOKEN");
  });

  it("rechaza URLs que no son de posta", () => {
    expect(extractToken("https://dominio.com/otra/pagina")).toBeNull();
    expect(extractToken("https://dominio.com/posta/")).toBeNull();
  });

  it("acepta un token desnudo válido", () => {
    expect(extractToken("abcdefgh12345")).toBe("abcdefgh12345");
  });

  it("rechaza tokens demasiado cortos o con caracteres inválidos", () => {
    expect(extractToken("abc")).toBeNull();
    expect(extractToken("ab cd ef")).toBeNull();
  });
});