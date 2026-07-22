import { describe, expect, it } from "vitest";
import { compareVersions, updateManifestSchema } from "./updater.js";

describe("atualizações", () => {
  it("compara versões semânticas", () => {
    expect(compareVersions("3.19.0", "3.18.9")).toBe(1);
    expect(compareVersions("3.18.0", "3.18.0")).toBe(0);
    expect(compareVersions("3.17.9", "3.18.0")).toBe(-1);
  });

  it("aceita um manifesto válido", () => {
    const parsed = updateManifestSchema.parse({
      product: "AtendeFlow",
      version: "3.19.0",
      publishedAt: "2026-07-22T12:00:00.000Z",
      required: false,
      packageUrl: "https://atendeflow.web.app/updates/update.zip",
      sha256: "a".repeat(64),
      notes: ["Correções"],
    });
    expect(parsed.version).toBe("3.19.0");
  });

  it("rejeita produto, versão e hash inválidos", () => {
    expect(() =>
      updateManifestSchema.parse({
        product: "Outro",
        version: "3.19",
        publishedAt: "hoje",
        packageUrl: "http://arquivo",
        sha256: "123",
      }),
    ).toThrow();
  });
});
