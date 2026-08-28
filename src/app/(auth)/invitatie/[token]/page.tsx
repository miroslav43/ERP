// src/app/(auth)/invitatie/[token]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { z } from "zod";
import { Buton } from "@/components/ui/buton";
import { createServerSupabase } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/utils/rate-limit";
import { param, tokenInvitatieSchema } from "@/schemas/auth";
import { acceptaInvitatia, creeazaContSiAccepta } from "./actions";

export const metadata: Metadata = { title: "Invitație" };
export const dynamic = "force-dynamic";

/**
 * `peek_invitation` nu întoarce adresa ÎNTREAGĂ: ar transforma tokenul în
 * oracol de adrese. Întoarce masca (`mal•••@gmail.com`), cât să vadă omul cui
 * îi aparține contul care se creează, plus dacă adresa are deja cont — de asta
 * depinde care formular se arată.
 */
const peekSchema = z.object({
  organization_name: z.string().min(1),
  expired: z.boolean(),
  email_mascat: z.string(),
  are_cont: z.boolean(),
});

const MESAJE: Record<string, string> = {
  parola: "Parola trebuie să aibă cel puțin 12 caractere.",
  confirmare: "Cele două parole nu coincid.",
  limita: "Prea multe încercări. Reîncercați peste câteva minute.",
  sesiune: "Sesiunea a expirat. Deschideți din nou linkul din e-mail.",
  invalida: "Invitația nu mai este validă.",
  creare: "Contul nu a putut fi creat. Reîncercați peste câteva minute.",
  "are-cont":
    "Adresa aceasta are deja un cont. Autentificați-vă, apoi reveniți pe acest link ca să acceptați invitația.",
  "alta-adresa":
    "Invitația a fost emisă pentru altă adresă de e-mail. Autentificați-vă cu adresa pe care ați primit invitația.",
};

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const CLASA_CONTROL =
  "border-border bg-background focus:border-ring rounded-control text-corp pointer-coarse:text-sectiune w-full border px-3 py-2";

function Invalida() {
  return (
    <>
      <h1 className="text-primary text-sectiune font-semibold">Invitația nu mai este validă.</h1>
      <p className="text-muted-foreground text-corp mt-2">
        Este posibil să fi expirat, să fi fost revocată sau deja folosită. Cereți o invitație nouă
        administratorului organizației.
      </p>
      <Link
        href="/autentificare"
        className="text-muted-foreground text-corp mt-6 inline-block rounded underline"
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
  const {
    organization_name: organizatie,
    email_mascat: adresa,
    are_cont: areCont,
  } = invitatie.data;

  return (
    <>
      <h1 className="text-primary text-sectiune font-semibold">Invitație în organizație</h1>
      <p className="text-muted-foreground text-corp mt-1">
        Ați fost invitat să vă alăturați organizației{" "}
        <span className="text-foreground font-medium">{organizatie}</span>.
      </p>

      {eroare !== null && (
        <p
          role="alert"
          className="text-danger border-danger/40 bg-danger/5 rounded-control text-corp mt-4 border px-3 py-2"
        >
          {eroare}
        </p>
      )}

      {sesiune.user ? (
        <form action={acceptaInvitatia} className="mt-6 flex flex-col gap-3">
          <input type="hidden" name="token" value={validat.data} />
          <p className="text-muted-foreground text-corp">
            Sunteți autentificat ca{" "}
            <span className="text-foreground font-medium">{sesiune.user.email}</span>.
          </p>
          <Buton type="submit" varianta="primar">
            Acceptă invitația
          </Buton>
        </form>
      ) : areCont ? (
        /*
         * Adresa are deja cont — invitație într-o a doua firmă, sau cineva care
         * lucra deja în aplicație. Nu i se cere o parolă nouă: ar suprascrie-o
         * pe cea existentă, sau ar eșua la server fără explicație.
         */
        <div className="mt-6 flex flex-col gap-3">
          <p className="text-muted-foreground text-corp">
            Adresa <span className="text-foreground font-medium">{adresa}</span> are deja un cont.
            Autentificați-vă, apoi reveniți pe acest link ca să acceptați invitația.
          </p>
          <Link
            href={`/autentificare?redirect=${encodeURIComponent(`/invitatie/${validat.data}`)}`}
            className="bg-primary text-primary-foreground rounded-control inline-flex min-h-11 items-center justify-center px-4 font-medium"
          >
            Mergi la autentificare
          </Link>
        </div>
      ) : (
        <form action={creeazaContSiAccepta} className="mt-6 flex flex-col gap-4">
          <input type="hidden" name="token" value={validat.data} />

          {/* Adresa mascată, ca omul să vadă pentru cine se face contul. Nu e
              un câmp: nu se poate schimba, e fixată de invitație. */}
          <p className="text-muted-foreground text-corp">
            Contul se creează pentru <span className="text-foreground font-medium">{adresa}</span>.
            Alegeți o parolă.
          </p>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="parola" className="text-corp font-medium">
              Parolă
            </label>
            <input
              id="parola"
              name="parola"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={72}
              className={CLASA_CONTROL}
            />
            <p className="text-muted-foreground text-nota">Cel puțin 12 caractere.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmare" className="text-corp font-medium">
              Confirmarea parolei
            </label>
            <input
              id="confirmare"
              name="confirmare"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={72}
              className={CLASA_CONTROL}
            />
          </div>

          <Buton type="submit" varianta="primar">
            Creează contul
          </Buton>
          <p className="text-muted-foreground text-nota">
            După ce contul e creat, vă ducem la autentificare ca să intrați cu parola aleasă.
          </p>
        </form>
      )}
    </>
  );
}
