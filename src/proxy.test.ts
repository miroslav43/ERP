import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ce apără fișierul: ORDINEA din `proxy()`. Fiecare cerere care ajunge la
 * `updateSession()` plătește o verificare de sesiune și o rescriere de
 * cookie-uri; ieșirile de mai jos există exact ca anumite clase de cereri să nu
 * le plătească.
 *
 * Rutele de API își verifică singure sesiunea și aruncau rezultatul. Prefetch-ul
 * de <Link> se face de zeci de ori per navigare — jurnalul nginx arată 74,7% din
 * trafic ca cereri `?_rsc=`, cu vârfuri de 38 într-o secundă.
 *
 * Testul verifică faptul mecanic (updateSession nu e chemat), nu efectul de
 * viteză, care nu se poate observa dintr-un test unitar.
 */
const updateSession = vi.fn();

vi.mock("@/lib/supabase/middleware", () => ({ updateSession }));

const { proxy } = await import("./proxy");

function cerere(cale: string, antete: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(cale, "https://administrativo.ro"), { headers: antete });
}

describe("proxy", () => {
  beforeEach(() => {
    updateSession.mockReset();
    updateSession.mockResolvedValue({
      response: NextResponse.next(),
      autentificat: true,
    });
  });

  it("nu verifică sesiunea pentru rutele de API", async () => {
    await proxy(cerere("/api/reges/sincronizare"));
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("nu verifică sesiunea pentru un prefetch de <Link>", async () => {
    await proxy(cerere("/pontaj", { "Next-Router-Prefetch": "1" }));
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("verifică sesiunea pentru o navigare obișnuită", async () => {
    await proxy(cerere("/pontaj"));
    expect(updateSession).toHaveBeenCalledTimes(1);
  });

  it("verifică sesiunea și pentru o cerere RSC care nu e prefetch", async () => {
    await proxy(cerere("/pontaj", { RSC: "1" }));
    expect(updateSession).toHaveBeenCalledTimes(1);
  });
});

/**
 * Slugurile necunoscute ale celor două rute prerandate.
 *
 * Fiecare `/module/<orice>` randa o dată 404-ul și îl lăsa pe disc, ~1 MB, până
 * la deploy-ul următor (auditul din 7 oct 2026). Acum se rescriu spre o cale fără
 * rută, înainte de pagină și fără să coste o verificare de sesiune.
 */
describe("proxy — sluguri necunoscute", () => {
  beforeEach(() => {
    updateSession.mockReset();
    updateSession.mockResolvedValue({ response: NextResponse.next(), autentificat: false });
  });

  it("rescrie un modul inexistent spre 404, fără să atingă pagina", async () => {
    const raspuns = await proxy(cerere("/module/zz-q7x-test"));
    expect(raspuns.headers.get("x-middleware-rewrite")).toMatch(/\/__adresa-necunoscuta$/);
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("rescrie un domeniu inexistent, dar lasă în pace domeniile și modulele reale", async () => {
    expect(
      (await proxy(cerere("/domenii/zz-q7x"))).headers.get("x-middleware-rewrite"),
    ).toBeTruthy();
    for (const cale of [
      "/module/pontaj",
      "/module/portal-angajat",
      "/domenii/constructii",
      "/module",
      "/domenii",
    ]) {
      expect((await proxy(cerere(cale))).headers.get("x-middleware-rewrite"), cale).toBeNull();
    }
  });

  it("domeniile scrise în proxy sunt exact cele din conținut", async () => {
    const { SLUGURI_CUNOSCUTE } = await import("./proxy");
    const { DOMENII } = await import("@/content/landing/domenii");
    expect([...(SLUGURI_CUNOSCUTE["domenii"] ?? [])].sort()).toEqual(
      DOMENII.map((d) => d.slug).sort(),
    );
  });
});

/**
 * Vizitatorul nelogat: cine primește ecranul de autentificare și cine nu.
 *
 * Până la 17 sept 2026 orice cale nepublică primea 307 spre `/autentificare`,
 * inclusiv una inexistentă. `/blog` sau un link vechi ajungeau în index ca
 * pagină de login („soft 404”). Acum redirectul e doar pentru segmentele
 * aplicației, comparate ca segment ÎNTREG — `pontaj` e prefix pentru
 * `/pontaj-pe-telefon`.
 */
describe("proxy — vizitator nelogat", () => {
  beforeEach(() => {
    updateSession.mockReset();
    updateSession.mockResolvedValue({ response: NextResponse.next(), autentificat: false });
  });

  const esteRedirectLaLogin = (r: NextResponse): boolean =>
    r.status === 307 && (r.headers.get("location") ?? "").includes("/autentificare");

  it("trimite la autentificare o rută a aplicației, cu destinația păstrată", async () => {
    const r = await proxy(cerere("/pontaj/2026-09"));
    expect(esteRedirectLaLogin(r)).toBe(true);
    expect(r.headers.get("location")).toContain("redirect=%2Fpontaj%2F2026-09");
  });

  it("lasă o cale inexistentă să primească 404, nu ecranul de login", async () => {
    for (const cale of ["/asdkjaslkdjalksjd", "/blog", "/wp-login.php", "/pontajx"]) {
      expect(esteRedirectLaLogin(await proxy(cerere(cale))), cale).toBe(false);
    }
  });

  it("nu confundă o pagină publică cu modulul care îi e prefix", async () => {
    for (const cale of ["/pontaj-pe-telefon", "/reges-online", "/preturi", "/"]) {
      expect(esteRedirectLaLogin(await proxy(cerere(cale))), cale).toBe(false);
    }
  });
});
