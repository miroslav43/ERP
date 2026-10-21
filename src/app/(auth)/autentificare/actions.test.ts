// src/app/(auth)/autentificare/actions.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Regula pe care o apără fișierul: **la o autentificare eșuată, e-mailul tastat
 * se păstrează** (ONB-023).
 *
 * `<form action>` resetează câmpurile după acțiune, iar pagina e un Server
 * Component care nu primește înapoi decât URL-ul de redirect. E-mailul NU merge
 * în URL — ar ajunge în jurnalele nginx și în istoricul browserului — ci într-un
 * cookie httpOnly de 60 s, pe `/autentificare`, pe care pagina îl citește doar
 * când există `?eroare=`. Contractul `?eroare=` rămâne: îl așteaptă
 * `e2e/global-setup.ts`.
 *
 * Tot ce iese din proces e fals: antetele, cookie-urile, GoTrue, contorul de
 * rată. `raspunsUniform` (700 ms, anti-enumerare) se sare cu timere false.
 */
const { Redirectionare, setCookie, signInWithPassword, consumeRateLimit } = vi.hoisted(() => {
  class Redirectionare extends Error {
    constructor(readonly url: string) {
      super(`redirect: ${url}`);
      this.name = "Redirectionare";
    }
  }
  return {
    Redirectionare,
    setCookie: vi.fn(),
    signInWithPassword: vi.fn(),
    consumeRateLimit: vi.fn(),
  };
});

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "1.2.3.4" }),
  cookies: async () => ({ set: setCookie }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Redirectionare(url);
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ auth: { signInWithPassword } }),
}));
vi.mock("@/lib/utils/rate-limit", () => ({ consumeRateLimit }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: () => ({}) }));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));

import { autentificarePrinParola } from "./actions";

function formular(campuri: Readonly<Record<string, string>>): FormData {
  const date = new FormData();
  for (const [nume, valoare] of Object.entries(campuri)) date.set(nume, valoare);
  return date;
}

/** Rulează acțiunea peste pragul `raspunsUniform` și întoarce URL-ul de redirect. */
async function urlDupa(date: FormData): Promise<string> {
  const promisiune = autentificarePrinParola(date).then(
    () => {
      throw new Error("acțiunea trebuia să redirecționeze");
    },
    (eroare: unknown) => eroare,
  );
  await vi.runAllTimersAsync();
  const eroare = await promisiune;
  if (!(eroare instanceof Redirectionare)) throw eroare;
  return eroare.url;
}

const COOKIE = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/autentificare",
  maxAge: 60,
};

beforeEach(() => {
  vi.useFakeTimers();
  setCookie.mockReset();
  signInWithPassword.mockReset();
  consumeRateLimit.mockReset();
  consumeRateLimit.mockResolvedValue({ allowed: true });
  signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("autentificarePrinParola — e-mailul se păstrează la eșec", () => {
  it("parolă greșită → cookie cu e-mailul, apoi ?eroare=credentiale", async () => {
    const url = await urlDupa(formular({ email: "Ana@Example.com", parola: "gresita" }));

    expect(url).toBe("/autentificare?eroare=credentiale");
    expect(setCookie).toHaveBeenCalledTimes(1);
    // Normalizat de schemă: așa a fost și căutat contul.
    expect(setCookie).toHaveBeenCalledWith("autentificare_email", "ana@example.com", COOKIE);
  });

  it("limită atinsă → cookie cu e-mailul, apoi ?eroare=limita, fără GoTrue", async () => {
    consumeRateLimit.mockResolvedValue({ allowed: false });

    const url = await urlDupa(formular({ email: "ana@example.com", parola: "x" }));

    expect(url).toBe("/autentificare?eroare=limita");
    expect(setCookie).toHaveBeenCalledWith("autentificare_email", "ana@example.com", COOKIE);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("date invalide → NICIUN cookie, ?eroare=date", async () => {
    // Un e-mail care n-a trecut schema nu se păstrează: nu-l punem înapoi în
    // câmp ca să-l trimită a doua oară identic.
    const url = await urlDupa(formular({ email: "nu-e-adresa", parola: "" }));

    expect(url).toBe("/autentificare?eroare=date");
    expect(setCookie).not.toHaveBeenCalled();
  });

  it("autentificare reușită → fără cookie, redirect la destinație", async () => {
    signInWithPassword.mockResolvedValue({ error: null });

    const url = await urlDupa(
      formular({ email: "ana@example.com", parola: "corecta", redirect: "/panou" }),
    );

    expect(url).toBe("/panou");
    expect(setCookie).not.toHaveBeenCalled();
  });
});
