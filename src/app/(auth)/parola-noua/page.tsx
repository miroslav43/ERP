// src/app/(auth)/parola-noua/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { param } from "@/schemas/auth";
import { seteazaParolaNoua } from "./actions";

export const metadata: Metadata = { title: "Parolă nouă" };
export const dynamic = "force-dynamic";

const MESAJE: Record<string, string> = {
  parola: "Parola trebuie să aibă cel puțin 12 caractere.",
  confirmare: "Cele două parole nu coincid.",
  refuzata: "Parola nu a putut fi schimbată. Solicitați un link nou de resetare.",
};

const CLASA_CAMP =
  "border-border bg-background focus:border-ring w-full rounded-md border px-3 py-2 text-sm";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PaginaParolaNoua({ searchParams }: Props) {
  const parametri = await searchParams;
  const eroare = MESAJE[param(parametri.eroare) ?? ""] ?? null;

  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return (
      <>
        <h1 className="text-primary text-xl font-semibold">Link expirat</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Linkul de resetare nu mai este valid sau a fost deja folosit. Solicitați unul nou.
        </p>
        <Link
          href="/resetare-parola"
          className="bg-primary text-primary-foreground hover:bg-primary-hover mt-6 inline-block rounded-md px-4 py-2 text-sm font-medium"
        >
          Cere un link nou
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-primary text-xl font-semibold">Alegeți o parolă nouă</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Minimum 12 caractere. Nu refolosiți o parolă de pe alt site.
      </p>

      {eroare !== null && (
        <p
          role="alert"
          className="text-danger border-danger/40 bg-danger/5 mt-4 rounded-md border px-3 py-2 text-sm"
        >
          {eroare}
        </p>
      )}

      <form action={seteazaParolaNoua} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="parola" className="text-sm font-medium">
            Parolă nouă
          </label>
          <input
            id="parola"
            name="parola"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            aria-describedby="ajutor-parola"
            className={CLASA_CAMP}
          />
          <p id="ajutor-parola" className="text-muted-foreground text-xs">
            Cel puțin 12 caractere.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmare" className="text-sm font-medium">
            Confirmarea parolei
          </label>
          <input
            id="confirmare"
            name="confirmare"
            type="password"
            autoComplete="new-password"
            required
            className={CLASA_CAMP}
          />
        </div>
        <button
          type="submit"
          className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          Salvează parola
        </button>
      </form>
    </>
  );
}
