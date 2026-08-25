// src/lib/media/link-extern.test.ts
import { describe, expect, it } from "vitest";

import { adresaIncorporare, adresaPublica, analizeazaLink } from "./link-extern";

const ok = (intrare: string) => {
  const r = analizeazaLink(intrare);
  if (!r.ok) throw new Error(`așteptam succes, am primit: ${r.motiv}`);
  return r.link;
};

describe("analizeazaLink — formele reale în care oamenii lipesc linkuri", () => {
  it("YouTube: watch, youtu.be, embed, shorts", () => {
    expect(ok("https://www.youtube.com/watch?v=dQw4w9WgXcQ").id).toBe("dQw4w9WgXcQ");
    expect(ok("https://youtu.be/dQw4w9WgXcQ").id).toBe("dQw4w9WgXcQ");
    expect(ok("https://www.youtube.com/embed/dQw4w9WgXcQ").id).toBe("dQw4w9WgXcQ");
    expect(ok("https://www.youtube.com/shorts/dQw4w9WgXcQ").id).toBe("dQw4w9WgXcQ");
    expect(ok("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30s").furnizor).toBe("youtube");
  });

  it("Vimeo: cu și fără codul filmului nelistat", () => {
    expect(ok("https://vimeo.com/123456789").codPrivat).toBeNull();
    expect(ok("https://player.vimeo.com/video/123456789").id).toBe("123456789");
    // Fără `h=`, un film nelistat merge pentru cel care l-a adăugat și NU merge
    // pentru angajați — de aceea codul se păstrează.
    expect(ok("https://vimeo.com/123456789?h=abc123def456").codPrivat).toBe("abc123def456");
  });

  it("Loom: share și embed", () => {
    const id = "a".repeat(32);
    expect(ok(`https://www.loom.com/share/${id}`).id).toBe(id);
    expect(ok(`https://loom.com/embed/${id}`).furnizor).toBe("loom");
  });
});

describe("analizeazaLink — ce refuză", () => {
  it("respinge un domeniu care doar SEAMĂNĂ (capcana `endsWith`)", () => {
    const r = analizeazaLink("https://evilyoutube.com/watch?v=dQw4w9WgXcQ");
    expect(r.ok).toBe(false);
  });

  it("respinge subdomeniul necunoscut", () => {
    expect(analizeazaLink("https://youtube.com.atacator.ro/watch?v=dQw4w9WgXcQ").ok).toBe(false);
  });

  it("respinge alt protocol decât https", () => {
    expect(analizeazaLink("http://www.youtube.com/watch?v=dQw4w9WgXcQ").ok).toBe(false);
    expect(analizeazaLink("javascript:alert(1)").ok).toBe(false);
    expect(analizeazaLink("data:text/html,<script>alert(1)</script>").ok).toBe(false);
  });

  it("respinge credențialele din adresă", () => {
    expect(analizeazaLink("https://user:parola@www.youtube.com/watch?v=dQw4w9WgXcQ").ok).toBe(false);
  });

  it("respinge identificatorul de lungime greșită", () => {
    expect(analizeazaLink("https://www.youtube.com/watch?v=prea-scurt").ok).toBe(false);
    expect(analizeazaLink("https://vimeo.com/12").ok).toBe(false);
  });

  it("respinge un furnizor neacceptat, cu un motiv folositor", () => {
    const r = analizeazaLink("https://www.dailymotion.com/video/x8abcde");
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motiv).toContain("încărcați fișierul");
  });

  it("fiecare refuz e o propoziție care se termină cu punct", () => {
    for (const intrare of ["", "nu e url", "http://youtube.com/watch?v=dQw4w9WgXcQ", "https://x.ro/a"]) {
      const r = analizeazaLink(intrare);
      expect(r.ok).toBe(false);
      expect(r.ok === false && /[.”]$/.test(r.motiv)).toBe(true);
    }
  });
});

describe("adresele reconstruite din șablon", () => {
  it("YouTube merge prin nocookie și fără parametri moșteniți", () => {
    const link = ok("https://www.youtube.com/watch?v=dQw4w9WgXcQ&autoplay=1&enablejsapi=1");
    const adresa = adresaIncorporare(link);
    expect(adresa).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1");
    // Parametrii ostili din intrare nu supraviețuiesc reconstrucției.
    expect(adresa).not.toContain("autoplay");
    expect(adresa).not.toContain("enablejsapi");
  });

  it("Vimeo păstrează codul privat în încorporare și în adresa publică", () => {
    const link = ok("https://vimeo.com/123456789?h=abc123def456");
    expect(adresaIncorporare(link)).toBe("https://player.vimeo.com/video/123456789?h=abc123def456");
    expect(adresaPublica(link)).toBe("https://vimeo.com/123456789/abc123def456");
  });

  it("toate adresele construite rămân pe gazde cunoscute", () => {
    const gazdePermise = [
      "www.youtube-nocookie.com", "player.vimeo.com", "www.loom.com",
      "www.youtube.com", "vimeo.com",
    ];
    for (const intrare of [
      "https://youtu.be/dQw4w9WgXcQ",
      "https://vimeo.com/123456789",
      `https://www.loom.com/share/${"b".repeat(32)}`,
    ]) {
      const link = ok(intrare);
      for (const adresa of [adresaIncorporare(link), adresaPublica(link)]) {
        expect(gazdePermise).toContain(new URL(adresa).hostname);
      }
    }
  });
});
