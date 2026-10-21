// src/lib/storage/semnatura.test.ts
//
// Semnăturile de început de fișier („magic bytes”): MIME-ul declarat de
// browser nu e o dovadă, iar antetul `content-type` măsurat de Storage e tot
// cel declarat. Singurul lucru care spune ce E fișierul sunt primii lui octeți.
// Cazurile HR-003 și ANG-014 sunt literal „1024 de zerouri declarate PDF”.

import { describe, expect, it } from "vitest";

import { MESAJ_CONTINUT_NEPOTRIVIT, OCTETI_SEMNATURA, potrivesteSemnatura } from "./semnatura";

/** Octeții dați, urmați de zerouri cât să nu cadă niciun offset în afara șirului. */
const octeti = (...v: number[]) => Uint8Array.from(v.concat(new Array(32).fill(0)));

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const PDF = octeti(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31);
const PNG = octeti(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPEG = octeti(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46);
// "RIFF" + mărime (4 octeți oarecare) + "WEBP"
const WEBP = octeti(0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50);
const ZIP = octeti(0x50, 0x4b, 0x03, 0x04);
const MP4 = octeti(0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d);
const HEIC = octeti(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63);
// "<!DOCTYPE html"
const HTML = octeti(0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54, 0x59, 0x50, 0x45, 0x20, 0x68, 0x74);

describe("potrivesteSemnatura — MIME-ul din formular nu e o dovadă", () => {
  it("recunoaşte PDF, MP4, WebM şi WebVTT", () => {
    expect(potrivesteSemnatura("application/pdf", PDF)).toBe(true);
    expect(potrivesteSemnatura("video/mp4", MP4)).toBe(true);
    expect(potrivesteSemnatura("video/webm", octeti(0x1a, 0x45, 0xdf, 0xa3))).toBe(true);
    expect(potrivesteSemnatura("text/vtt", octeti(0x57, 0x45, 0x42, 0x56, 0x54, 0x54))).toBe(true);
  });

  it("acceptă WebVTT cu marcă de ordine a octeţilor", () => {
    expect(
      potrivesteSemnatura("text/vtt", octeti(0xef, 0xbb, 0xbf, 0x57, 0x45, 0x42, 0x56, 0x54, 0x54)),
    ).toBe(true);
  });

  it("recunoaște imaginile din dosar: PNG, JPEG, WEBP", () => {
    expect(potrivesteSemnatura("image/png", PNG)).toBe(true);
    expect(potrivesteSemnatura("image/jpeg", JPEG)).toBe(true);
    expect(potrivesteSemnatura("image/webp", WEBP)).toBe(true);
  });

  it("recunoaște HEIC/HEIF (fotografiile de iPhone din mentenanță) după caseta `ftyp`", () => {
    expect(potrivesteSemnatura("image/heic", HEIC)).toBe(true);
    expect(potrivesteSemnatura("image/heif", HEIC)).toBe(true);
  });

  it("recunoaște Word și Excel după antetul ZIP local — orice arhivă trece, limită asumată", () => {
    expect(potrivesteSemnatura(DOCX, ZIP)).toBe(true);
    expect(potrivesteSemnatura(XLSX, ZIP)).toBe(true);
  });

  it("1024 de zerouri declarate PDF, PNG, JPEG, WEBP sau Word: false (HR-003, ANG-014)", () => {
    const zerouri = new Uint8Array(1024);
    expect(potrivesteSemnatura("application/pdf", zerouri)).toBe(false);
    expect(potrivesteSemnatura("image/png", zerouri)).toBe(false);
    expect(potrivesteSemnatura("image/jpeg", zerouri)).toBe(false);
    expect(potrivesteSemnatura("image/webp", zerouri)).toBe(false);
    expect(potrivesteSemnatura(DOCX, zerouri)).toBe(false);
  });

  it("o imagine reală declarată ca ALT tip de imagine: false", () => {
    expect(potrivesteSemnatura("image/png", JPEG)).toBe(false);
    expect(potrivesteSemnatura("image/jpeg", PNG)).toBe(false);
    expect(potrivesteSemnatura("image/webp", PNG)).toBe(false);
  });

  it("RIFF fără „WEBP” la offset 8 (un WAV redenumit) nu e WEBP", () => {
    const wav = octeti(0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45);
    expect(potrivesteSemnatura("image/webp", wav)).toBe(false);
  });

  it("respinge HTML deghizat — vectorul de atac real, oricare ar fi tipul declarat", () => {
    expect(potrivesteSemnatura("video/mp4", HTML)).toBe(false);
    expect(potrivesteSemnatura("application/pdf", HTML)).toBe(false);
    expect(potrivesteSemnatura("image/png", HTML)).toBe(false);
    expect(potrivesteSemnatura(DOCX, HTML)).toBe(false);
  });

  it("respinge un MIME pe care nu-l cunoaştem", () => {
    expect(potrivesteSemnatura("image/svg+xml", octeti(0x3c, 0x73, 0x76, 0x67))).toBe(false);
    expect(potrivesteSemnatura("image/gif", octeti(0x47, 0x49, 0x46, 0x38))).toBe(false);
  });

  it("un șir mai scurt decât semnătura nu aruncă, întoarce false", () => {
    expect(potrivesteSemnatura("application/pdf", new Uint8Array([0x25, 0x50]))).toBe(false);
    expect(potrivesteSemnatura("image/webp", new Uint8Array([0x52, 0x49, 0x46, 0x46]))).toBe(false);
    expect(potrivesteSemnatura("video/mp4", new Uint8Array(0))).toBe(false);
  });
});

describe("contractul cu clienții care citesc capul fișierului", () => {
  it("OCTETI_SEMNATURA acoperă cel mai lung offset + lungime (12, pentru WEBP)", () => {
    expect(OCTETI_SEMNATURA).toBeGreaterThanOrEqual(12);
    // Exact capul pe care îl trimite clientul trebuie să ajungă pentru fiecare tip.
    expect(potrivesteSemnatura("image/webp", WEBP.slice(0, OCTETI_SEMNATURA))).toBe(true);
    expect(potrivesteSemnatura("video/mp4", MP4.slice(0, OCTETI_SEMNATURA))).toBe(true);
    expect(potrivesteSemnatura("image/png", PNG.slice(0, OCTETI_SEMNATURA))).toBe(true);
  });

  it("mesajul de refuz e o propoziție încheiată cu punct", () => {
    expect(MESAJ_CONTINUT_NEPOTRIVIT).toMatch(/\.$/u);
  });
});
