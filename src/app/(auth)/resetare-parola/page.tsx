// src/app/(auth)/resetare-parola/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { param } from "@/schemas/auth";
import { cereResetareParola } from "./actions";

export const metadata: Metadata = { title: "Resetare parolă" };
export const dynamic = "force-dynamic";

const MESAJE: Record<string, string> = {
  email: "Adresa de e-mail nu este validă.",
  limita: "Prea multe cereri. Reîncercați peste câteva minute.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PaginaResetareParola({ searchParams }: Props) {
  const parametri = await searchParams;
  const eroare = MESAJE[param(parametri.eroare) ?? ""] ?? null;
  const trimis = param(parametri.stare) === "trimis";

  return (
    <>
      <h1 className="text-primary text-xl font-semibold">Resetarea parolei</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Vă trimitem un link pe e-mail cu care puteți alege o parolă nouă.
      </p>

      {eroare !== null && (
        <p
          role="alert"
          className="text-danger border-danger/40 bg-danger/5 mt-4 rounded-md border px-3 py-2 text-sm"
        >
          {eroare}
        </p>
      )}
      {trimis && (
        <p
          role="status"
          className="text-success border-success/40 bg-success/5 mt-4 rounded-md border px-3 py-2 text-sm"
        >
          Dacă adresa introdusă are un cont activ, veți primi în câteva minute un link de resetare.
        </p>
      )}

      <form action={cereResetareParola} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Adresă de e-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            className="border-border bg-background focus:border-ring w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          Trimite linkul de resetare
        </button>
      </form>

      <p className="mt-6 text-sm">
        <Link href="/autentificare" className="text-muted-foreground rounded underline">
          Înapoi la autentificare
        </Link>
      </p>
    </>
  );
}
