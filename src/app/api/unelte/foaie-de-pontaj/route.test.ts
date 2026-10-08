import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "./route";

const cere = (interogare: string) =>
  GET(new NextRequest(`http://localhost/api/unelte/foaie-de-pontaj?${interogare}`));

describe("ruta foii de pontaj", () => {
  it("Excel-ul cu nume iese cu cache-control private, no-store", async () => {
    const r = await cere("luna=10&an=2026&angajati=Ion+Popa");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("spreadsheetml");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });

  it("PDF-ul trece prin răspunsul comun, cu același antet", async () => {
    const r = await cere("luna=10&an=2026&angajati=Ion+Popa&format=pdf");
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });
});
