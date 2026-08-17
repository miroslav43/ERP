// src/app/(auth)/invitatie/[token]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/utils/rate-limit";
import { param, tokenInvitatieSchema } from "@/schemas/auth";
import { acceptaInvitatia, trimiteLinkInvitatie } from "./actions";

export const metadata: Metadata = { title: "Invitație" };
export const dynamic = "force-dynamic";

/** `peek_invitation` NU întoarce adresa de e-mail: ar transforma tokenul în oracol. */
const peekSchema = z.object({ organization_name: z.string().min(1), expired: z.boolean() });

const MESAJE: Record<string, string> = {
  email: "Adresa de e-mail nu este validă.",
  limita: "Prea multe încercări. Reîncercați peste câteva minute.",
  sesiune: "Sesiunea a expirat. Cereți din nou un link de autentificare.",
  invalida: "Invitația nu mai este validă.",
  "alta-adresa":
    "Invitația a fost emisă pentru altă adresă de e-mail. Autentificați-vă cu adresa pe care ați primit invitația.",
};

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function Invalida() {
  return (
    <>
      <h1 className="text-primary text-xl font-semibold">Invitația nu mai este validă.</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Este posibil să fi expirat, să fi fost revocată sau deja folosită. Cereți o invitație nouă
        administratorului organizației.
      </p>
      <Link
        href="/autentificare"
        className="text-muted-foreground mt-6 inline-block rounded text-sm underline"
      >
        Mergi la autentificare
      </Link>
    </>
  );
}

export default async function PaginaInvitatie({ params, searchParams }: Props) {
  const { token } = await params;
  const parametri = await searchParams;
  const validat = tokenInvitatieSchema.safeParse(token);
  if (!validat.success) return <Invalida />;

  const antet = await headers();
  const ip = antet.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "necunoscut";
  const limita = await consumeRateLimit({ key: `peek:ip:${ip}`, limit: 30, windowSeconds: 900 });
  if (!limita.allowed) return <Invalida />;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("peek_invitation", { p_token: validat.data });
  const invitatie = error ? null : peekSchema.safeParse(data);

  // Mesaj IDENTIC pentru token inexistent, modificat, expirat, revocat sau folosit.
  if (!invitatie?.success || invitatie.data.expired) return <Invalida />;

  const { data: sesiune } = await supabase.auth.getUser();
  const eroare = MESAJE[param(parametri.eroare) ?? ""] ?? null;
  const linkTrimis = param(parametri.stare) === "link-trimis";

  return (
    <>
      <h1 className="text-primary text-xl font-semibold">Invitație în organizație</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Ați fost invitat să vă alăturați organizației{" "}
        <span className="text-foreground font-medium">{invitatie.data.organization_name}</span>.
      </p>

      {eroare !== null && (
        <p
          role="alert"
          className="text-danger border-danger/40 bg-danger/5 mt-4 rounded-md border px-3 py-2 text-sm"
        >
          {eroare}
        </p>
      )}
      {linkTrimis && (
        <p
          role="status"
          className="text-success border-success/40 bg-success/5 mt-4 rounded-md border px-3 py-2 text-sm"
        >
          Dacă adresa introdusă este cea invitată, veți primi în câteva minute un link de
          autentificare. Reveniți apoi pe această pagină.
        </p>
      )}

      {sesiune.user ? (
        <form action={acceptaInvitatia} className="mt-6 flex flex-col gap-3">
          <input type="hidden" name="token" value={validat.data} />
          <p className="text-muted-foreground text-sm">
            Sunteți autentificat ca{" "}
            <span className="text-foreground font-medium">{sesiune.user.email}</span>.
          </p>
          <button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-4 py-2 text-sm font-medium transition-colors"
          >
            Acceptă invitația
          </button>
        </form>
      ) : (
        <form action={trimiteLinkInvitatie} className="mt-6 flex flex-col gap-4">
          <input type="hidden" name="token" value={validat.data} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Adresa de e-mail pe care ați primit invitația
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="border-border bg-background focus:border-ring w-full rounded-md border px-3 py-2 text-sm outline-none"
            />
          </div>
          <button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-4 py-2 text-sm font-medium transition-colors"
          >
            Trimite-mi linkul de autentificare
          </button>
        </form>
      )}
    </>
  );
}
