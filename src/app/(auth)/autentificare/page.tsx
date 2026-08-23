// src/app/(auth)/autentificare/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Buton } from "@/components/ui/buton";
import { createServerSupabase } from "@/lib/supabase/server";
import { caleInterna, param } from "@/schemas/auth";
import { autentificarePrinParola, trimiteLinkMagic } from "./actions";

export const metadata: Metadata = { title: "Autentificare" };
export const dynamic = "force-dynamic";

const MESAJE: Record<string, string> = {
  date: "Completați adresa de e-mail și parola.",
  email: "Adresa de e-mail nu este validă.",
  credentiale: "Adresa de e-mail sau parola nu sunt corecte.",
  limita: "Prea multe încercări. Reîncercați peste câteva minute.",
  link: "Linkul nu mai este valid. Solicitați unul nou.",
  sesiune: "Sesiunea a expirat. Autentificați-vă din nou.",
};

/**
 * `pointer-coarse:text-sectiune` nu e decor: sub 16px, iOS Safari mărește pagina la
 * fiecare atingere într-un câmp și nu o mai micșorează. `globals.css` are deja
 * regula pe `[data-zona]`, deci zona o acoperă deja; clasa de aici o repetă
 * deliberat, la nivel de element, ca un câmp scos vreodată din zonă să nu
 * regreseze tăcut. Pe laptop nu se schimbă nimic —
 * `pointer-coarse` prinde doar ecranele atinse cu degetul.
 */
const CLASA_CAMP =
  "border-border bg-background focus:border-ring rounded-control text-corp w-full border px-3 py-2 pointer-coarse:text-sectiune";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PaginaAutentificare({ searchParams }: Props) {
  const parametri = await searchParams;
  const catre = caleInterna(param(parametri.redirect));

  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect(catre);

  const eroare = MESAJE[param(parametri.eroare) ?? ""] ?? null;
  const linkTrimis = param(parametri.stare) === "link-trimis";

  return (
    <>
      <h1 className="text-primary text-sectiune font-semibold">Autentificare</h1>
      <p className="text-muted-foreground text-corp mt-1">
        Introduceți datele contului sau cereți un link de autentificare pe e-mail.
      </p>

      {eroare !== null && (
        <p
          role="alert"
          className="text-danger border-danger/40 bg-danger/5 rounded-control text-corp mt-4 border px-3 py-2"
        >
          {eroare}
        </p>
      )}
      {linkTrimis && (
        <p
          role="status"
          className="text-success border-success/40 bg-success/5 rounded-control text-corp mt-4 border px-3 py-2"
        >
          Dacă adresa introdusă are un cont activ, veți primi în câteva minute un link de
          autentificare. Linkul este valabil o singură dată.
        </p>
      )}

      <form action={autentificarePrinParola} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="redirect" value={catre} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-corp font-medium">
            Adresă de e-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            inputMode="email"
            className={CLASA_CAMP}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="parola" className="text-corp font-medium">
              Parolă
            </label>
            <Link
              href="/resetare-parola"
              className="text-muted-foreground hover:text-foreground text-nota rounded underline"
            >
              Am uitat parola
            </Link>
          </div>
          <input
            id="parola"
            name="parola"
            type="password"
            autoComplete="current-password"
            required
            className={CLASA_CAMP}
          />
        </div>

        {/* Singurul navy din zonă: acțiunea care te duce înăuntru. */}
        <Buton type="submit" varianta="primar">
          Intră în cont
        </Buton>

        <div className="border-border relative border-t pt-4 text-center">
          <span className="bg-surface text-muted-foreground text-nota absolute -top-2.5 left-1/2 -translate-x-1/2 px-2">
            sau
          </span>
          {/* `formNoValidate`: linkul magic nu are nevoie de parolă. */}
          <Buton
            type="submit"
            varianta="secundar"
            formAction={trimiteLinkMagic}
            formNoValidate
            className="w-full"
          >
            Trimite-mi un link de autentificare
          </Buton>
        </div>
      </form>
    </>
  );
}
