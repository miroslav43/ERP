// src/app/(platform)/super-admin/organizatii/nou/_components/asistent-organizatie-noua.tsx
"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LinkInvitatie } from "../../[orgId]/membri/panou-membri";

import {
  onboardeazaOrganizatieSchema,
  type OnboardeazaOrganizatieInput,
} from "@/schemas/organization";
import { onboardeazaOrganizatie } from "../actions";
import { ProgresAsistent, ETICHETE_PASI } from "@/components/onboarding/progres-asistent";
import { Pas1Identitate, CAMPURI_PAS_1 } from "@/components/onboarding/pas-1-identitate";
import { Pas2Reprezentant, CAMPURI_PAS_2 } from "@/components/onboarding/pas-2-reprezentant";
import { Pas3Financiar, CAMPURI_PAS_3 } from "@/components/onboarding/pas-3-financiar";
import { Pas4Structura, CAMPURI_PAS_4 } from "@/components/onboarding/pas-4-structura";
import { Pas5Ssm, CAMPURI_PAS_5 } from "@/components/onboarding/pas-5-ssm";
import { Pas6Proprietar, CAMPURI_PAS_6 } from "@/components/onboarding/pas-6-proprietar";
import { Pas7Confirmare } from "@/components/onboarding/pas-7-confirmare";

const TOTAL_PASI = ETICHETE_PASI.length;

/** Câmpurile fiecărui pas validabil (1-6) — pasul 7 e doar recapitulare. */
const CAMPURI_PAS: readonly (readonly (keyof OnboardeazaOrganizatieInput)[])[] = [
  CAMPURI_PAS_1,
  CAMPURI_PAS_2,
  CAMPURI_PAS_3,
  CAMPURI_PAS_4,
  CAMPURI_PAS_5,
  CAMPURI_PAS_6,
];

function pasulPentruCamp(camp: string): number {
  const index = CAMPURI_PAS.findIndex((campuri) => (campuri as readonly string[]).includes(camp));
  return index === -1 ? 1 : index + 1;
}

export interface ValoriInitialeOnboarding {
  readonly name?: string;
  readonly slug?: string;
  readonly email_contact?: string;
  readonly telefon_contact?: string;
}

interface Proprietati {
  readonly valoriInitiale?: ValoriInitialeOnboarding;
}

interface RezultatSucces {
  readonly id: string;
  readonly name: string;
  readonly invitatie:
    | Readonly<{ trimisa: true; prinEmail: boolean; linkInvitatie: string }>
    | Readonly<{ trimisa: false; eroare: string }>;
}

export function AsistentOrganizatieNoua({ valoriInitiale }: Proprietati = {}) {
  const idFormular = useId();
  const [pasCurent, setPasCurent] = useState(1);
  const [eroareServer, setEroareServer] = useState<string | null>(null);
  const [rezultat, setRezultat] = useState<RezultatSucces | null>(null);

  const formular = useForm<OnboardeazaOrganizatieInput>({
    resolver: zodResolver(onboardeazaOrganizatieSchema),
    defaultValues: {
      plan: "trial",
      seats_limit: 10,
      platitor_tva: false,
      forma_juridica: "SRL",
      judet: "București",
      plata_avans: false,
      zile_concediu_anual_implicit: 20,
      name: valoriInitiale?.name ?? "",
      slug: valoriInitiale?.slug ?? "",
      email_contact: valoriInitiale?.email_contact ?? "",
      telefon_contact: valoriInitiale?.telefon_contact ?? "",
    },
  });
  const {
    handleSubmit,
    trigger,
    setError,
    formState: { isSubmitting },
  } = formular;

  const mergiInainte = async () => {
    try {
      const campuriPas = CAMPURI_PAS[pasCurent - 1];
      // `shouldFocus` mută atenția pe primul câmp invalid — fără el, o eroare
      // pe un câmp aflat mai jos în pas trece neobservată și pare că „nu s-a
      // întâmplat nimic” la apăsarea pe Continuă.
      const valid = campuriPas === undefined || (await trigger(campuriPas, { shouldFocus: true }));
      if (valid) setPasCurent((p) => Math.min(TOTAL_PASI, p + 1));
    } catch (eroare) {
      console.error("[asistent-organizatie-noua] mergiInainte", eroare);
      setEroareServer(
        `Nu am putut valida pasul curent: ${eroare instanceof Error ? eroare.message : String(eroare)}`,
      );
    }
  };
  const mergiInapoi = () => setPasCurent((p) => Math.max(1, p - 1));

  const trimite = handleSubmit(async (valori) => {
    setEroareServer(null);
    try {
      const raspuns = await onboardeazaOrganizatie(valori);
      if (raspuns.ok) {
        setRezultat(raspuns.data);
        return;
      }
      const erori = Object.entries(raspuns.error.fieldErrors ?? {});
      let primulPas: number | null = null;
      for (const [camp, mesaje] of erori) {
        const primul = mesaje[0];
        if (!primul) continue;
        setError(camp as keyof OnboardeazaOrganizatieInput, { type: "server", message: primul });
        const pasCamp = pasulPentruCamp(camp);
        if (primulPas === null || pasCamp < primulPas) primulPas = pasCamp;
      }
      if (primulPas !== null) setPasCurent(primulPas);
      setEroareServer(raspuns.error.message);
    } catch (eroare) {
      // Fără acest catch, un eșec neprevăzut al apelului server (rețea căzută,
      // acțiunea aruncă în loc să întoarcă `ok: false`) e o excepție
      // nepreluată: butonul iese din „Se creează…”, dar utilizatorul nu vede
      // niciun motiv.
      console.error("[asistent-organizatie-noua] trimite", eroare);
      setEroareServer(
        `Trimiterea a eșuat neașteptat: ${eroare instanceof Error ? eroare.message : String(eroare)}. Reîncercați.`,
      );
    }
  });

  if (rezultat !== null) {
    return (
      <div className="border-border bg-surface space-y-4 rounded-lg border p-6">
        <h2 className="text-foreground text-lg font-semibold">
          Organizația „{rezultat.name}” a fost creată
        </h2>
        {rezultat.invitatie.trimisa ? (
          <>
            <p className="text-muted-foreground text-sm">
              {rezultat.invitatie.prinEmail
                ? "Invitația a plecat pe e-mail către administrator. Linkul de mai jos e o rezervă, dacă mesajul nu ajunge — nu mai poate fi recuperat după ce părăsești pagina, fiindcă în baza de date se păstrează doar amprenta tokenului."
                : "Invitația a fost creată, dar e-mailul nu a putut fi trimis. Trimite manual linkul de mai jos — nu mai poate fi recuperat după ce părăsești pagina, fiindcă în baza de date se păstrează doar amprenta tokenului. Poate fi regenerat oricând din ecranul de membri."}
            </p>
            <LinkInvitatie link={rezultat.invitatie.linkInvitatie} />
          </>
        ) : (
          <p className="text-danger text-sm">
            Organizația s-a creat, dar invitația proprietarului nu a putut fi trimisă automat (
            {rezultat.invitatie.eroare}). Trimiteți-o manual din ecranul de membri.
          </p>
        )}
        <div className="flex gap-3">
          <Link
            href={`/super-admin/organizatii/${rezultat.id}`}
            className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-4 py-2 text-sm font-medium"
          >
            Deschide fișa organizației
          </Link>
          <Link
            href="/super-admin/organizatii"
            className="border-border text-foreground rounded-md border px-4 py-2 text-sm font-medium"
          >
            Înapoi la listă
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={trimite} noValidate className="space-y-6">
      <ProgresAsistent pasCurent={pasCurent} />

      <div aria-live="assertive">
        {eroareServer && (
          <p
            role="alert"
            className="border-border bg-surface text-danger rounded-md border p-3 text-sm"
          >
            {eroareServer}
          </p>
        )}
      </div>

      {pasCurent === 1 && <Pas1Identitate formular={formular} idFormular={idFormular} />}
      {pasCurent === 2 && <Pas2Reprezentant formular={formular} idFormular={idFormular} />}
      {pasCurent === 3 && <Pas3Financiar formular={formular} idFormular={idFormular} />}
      {pasCurent === 4 && <Pas4Structura formular={formular} idFormular={idFormular} />}
      {pasCurent === 5 && <Pas5Ssm formular={formular} idFormular={idFormular} />}
      {pasCurent === 6 && <Pas6Proprietar formular={formular} idFormular={idFormular} />}
      {pasCurent === 7 && <Pas7Confirmare formular={formular} />}

      <div className="flex items-center gap-3">
        {pasCurent > 1 && (
          <button
            type="button"
            onClick={mergiInapoi}
            className="border-border text-foreground rounded-md border px-4 py-2 text-sm font-medium"
          >
            Înapoi
          </button>
        )}
        {pasCurent < TOTAL_PASI ? (
          <button
            type="button"
            onClick={mergiInainte}
            className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-4 py-2 text-sm font-medium"
          >
            Continuă
          </button>
        ) : (
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Se creează…" : "Creează organizația"}
          </button>
        )}
        <p aria-live="polite" className="text-muted-foreground text-sm">
          {isSubmitting ? "Se salvează datele…" : ""}
        </p>
      </div>
    </form>
  );
}
