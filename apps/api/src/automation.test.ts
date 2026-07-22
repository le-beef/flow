import { describe, it, expect } from "vitest";
import { normalize, isOpen, randomTypingDelay } from "./rules.js";
describe("automação", () => {
  it("normaliza acentos e caixa", () =>
    expect(normalize("  CARDÁPIO ")).toBe("cardapio"));
  it("valida horário no fuso configurado", () => {
    const h = { timezone: "UTC", days: { 1: ["10:00", "12:00"] } };
    expect(isOpen(h, new Date("2026-07-20T11:00:00Z"))).toBe(true);
    expect(isOpen(h, new Date("2026-07-20T13:00:00Z"))).toBe(false);
  });
  it("aceita expediente que termina após meia-noite", () => {
    const h = { timezone: "UTC", days: { 1: ["18:00", "02:00"] } };
    expect(isOpen(h, new Date("2026-07-20T23:00:00Z"))).toBe(true);
    expect(isOpen(h, new Date("2026-07-21T01:00:00Z"))).toBe(true);
  });
  it("varia o tempo de digitação entre 1,5 e 3 segundos", () => {
    for (let i = 0; i < 100; i++) {
      const delay = randomTypingDelay();
      expect(delay).toBeGreaterThanOrEqual(1500);
      expect(delay).toBeLessThanOrEqual(3000);
    }
  });
});
