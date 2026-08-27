// src/lib/media/cale.test.ts
import { describe, expect, it } from "vitest";

import { PERMISSION_KEYS } from "@/config/permissions";
import { FEATURE_KEYS } from "@/config/features";

import {
  RESURSA_CURSURI,
  construiesteCaleMaterial,
  potrivesteSemnatura,
  prefixCaleMaterial,
  verificaMaterial,
  verificaSubtitrare,
} from "./cale";

const RESURSE_REALE = new Set(PERMISSION_KEYS.map((cheie) => cheie.split(":")[0]));

describe("contractul de cale al materialelor", () => {
  it("segmentul de resursă este o permisiune reală — altfel can_path refuză tăcut", () => {
    expect(RESURSE_REALE).toContain(RESURSA_CURSURI);
  });

  it("resursa, feature-ul și segmentul poartă acelaşi nume", () => {
    expect(FEATURE_KEYS).toContain(RESURSA_CURSURI);
  });

  it("respectă `^[a-z][a-z0-9_]{1,63}$` cerut de app.path_resource", () => {
    expect(RESURSA_CURSURI).toMatch(/^[a-z][a-z0-9_]{1,63}$/);
  });

  it("calea are patru segmente, în ordinea cerută de can_path", () => {
    const cale = construiesteCaleMaterial({
      organizationId: "774fb27a-98e7-4224-927c-49613223e00d",
      materialId: "8b867d05-d4c0-4a42-9bc7-ce21abe20ac4",
      versiune: 3,
      numeFisier: "Instructaj introductiv general.pdf",
    });
    const segmente = cale.split("/");
    expect(segmente).toHaveLength(4);
    expect(segmente[1]).toBe("courses");
    expect(segmente[3]).toMatch(/^v3-/);
    expect(segmente[3]).toContain("instructaj-introductiv-general.pdf");
  });

  it("prefixul anti-traversal e chiar începutul căii", () => {
    const intrare = { organizationId: "o1", materialId: "m1", versiune: 1, numeFisier: "a.pdf" };
    expect(construiesteCaleMaterial(intrare).startsWith(prefixCaleMaterial("o1", "m1"))).toBe(true);
  });

  it("două încărcări ale aceluiaşi fişier nu se suprascriu", () => {
    const intrare = { organizationId: "o1", materialId: "m1", versiune: 1, numeFisier: "a.pdf" };
    expect(construiesteCaleMaterial(intrare)).not.toBe(construiesteCaleMaterial(intrare));
  });
});

describe("verificaMaterial", () => {
  it("acceptă ce trebuie", () => {
    expect(verificaMaterial("pdf", "application/pdf", 1024)).toBeNull();
    expect(verificaMaterial("video", "video/mp4", 1024)).toBeNull();
    expect(verificaMaterial("video", "video/webm", 1024)).toBeNull();
  });

  it("respinge .mov, cu motivul scris", () => {
    const r = verificaMaterial("video", "video/quicktime", 1024);
    expect(r).not.toBeNull();
    expect(r).toContain(".mov");
  });

  it("respinge un PDF pus la video și invers", () => {
    expect(verificaMaterial("video", "application/pdf", 1024)).not.toBeNull();
    expect(verificaMaterial("pdf", "video/mp4", 1024)).not.toBeNull();
  });

  it("respinge fişierul gol şi pe cel peste plafon", () => {
    expect(verificaMaterial("pdf", "application/pdf", 0)).not.toBeNull();
    expect(verificaMaterial("pdf", "application/pdf", 26 * 1024 * 1024)).not.toBeNull();
    expect(verificaMaterial("video", "video/mp4", 201 * 1024 * 1024)).not.toBeNull();
  });

  it("plafonul de video e mai mare decât cel de PDF", () => {
    expect(verificaMaterial("video", "video/mp4", 100 * 1024 * 1024)).toBeNull();
    expect(verificaMaterial("pdf", "application/pdf", 100 * 1024 * 1024)).not.toBeNull();
  });
});

describe("verificaSubtitrare", () => {
  it("cere .vtt", () => {
    expect(verificaSubtitrare("text/vtt", 100)).toBeNull();
    expect(verificaSubtitrare("application/x-subrip", 100)).not.toBeNull();
  });
});

describe("potrivesteSemnatura — MIME-ul din formular nu e o dovadă", () => {
  const octeti = (...v: number[]) => Uint8Array.from(v.concat(new Array(32).fill(0)));

  it("recunoaşte PDF, MP4, WebM şi WebVTT", () => {
    expect(potrivesteSemnatura("application/pdf", octeti(0x25, 0x50, 0x44, 0x46))).toBe(true);
    expect(potrivesteSemnatura("video/mp4", octeti(0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70))).toBe(
      true,
    );
    expect(potrivesteSemnatura("video/webm", octeti(0x1a, 0x45, 0xdf, 0xa3))).toBe(true);
    expect(potrivesteSemnatura("text/vtt", octeti(0x57, 0x45, 0x42, 0x56, 0x54, 0x54))).toBe(true);
  });

  it("acceptă WebVTT cu marcă de ordine a octeţilor", () => {
    expect(
      potrivesteSemnatura("text/vtt", octeti(0xef, 0xbb, 0xbf, 0x57, 0x45, 0x42, 0x56, 0x54, 0x54)),
    ).toBe(true);
  });

  it("respinge HTML deghizat în MP4 — vectorul de atac real", () => {
    // "<!DOCTYPE html"
    const html = octeti(0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54, 0x59, 0x50, 0x45);
    expect(potrivesteSemnatura("video/mp4", html)).toBe(false);
    expect(potrivesteSemnatura("application/pdf", html)).toBe(false);
  });

  it("respinge un MIME pe care nu-l cunoaştem", () => {
    expect(potrivesteSemnatura("image/svg+xml", octeti(0x3c, 0x73, 0x76, 0x67))).toBe(false);
  });
});
