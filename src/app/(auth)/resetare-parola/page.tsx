// src/app/(auth)/resetare-parola/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Buton } from "@/components/ui/buton";
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
      <h1 className="text-primary text-sectiune font-semibold">Resetarea parolei</h1>
      <p className="text-muted-foreground text-corp mt-1">
        Vă trimitem un link pe e-mail cu care puteți alege o parolă nouă.
      </p>

      {eroare !== null && (
        <p
          role="alert"
          className="text-danger border-danger/40 bg-danger/5 rounded-control text-corp mt-4 border px-3 py-2"
        >
          {eroare}
        </p>
      )}
      {trimis && (
        <p
          role="status"
          className="text-success border-success/40 bg-success/5 rounded-control text-corp mt-4 border px-3 py-2"
        >
          Dacă adresa introdusă are un cont activ, veți primi în câteva minute un link de resetare.
        </p>
      )}

      <form action={cereResetareParola} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-corp font-medium">
            Adresă de e-mail
          </label>
          {/* `pointer-coarse:text-sectiune` — pragul de la care iOS Safari nu mai
              mărește pagina la focus. Vezi comentariul din `autentificare`. */}
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            className="border-border bg-background focus:border-ring rounded-control text-corp pointer-coarse:text-sectiune w-full border px-3 py-2"
          />
        </div>
        <Buton type="submit" varianta="primar">
          Trimite linkul de resetare
        </Buton>
      </form>

      <p className="text-corp mt-6">
        <Link href="/autentificare" className="text-muted-foreground rounded underline">
          Înapoi la autentificare
        </Link>
      </p>
    </>
  );
}
