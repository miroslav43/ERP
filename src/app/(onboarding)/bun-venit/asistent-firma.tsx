"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ETICHETE_PASI, ProgresAsistent } from "@/components/onboarding/progres-asistent";
import { Pas1Identitate, CAMPURI_PAS_1 } from "@/components/onboarding/pas-1-identitate";
import { Pas2Reprezentant, CAMPURI_PAS_2 } from "@/components/onboarding/pas-2-reprezentant";
import { Pas3Financiar, CAMPURI_PAS_3 } from "@/components/onboarding/pas-3-financiar";
import { Pas4Structura, CAMPURI_PAS_4 } from "@/components/onboarding/pas-4-structura";
import { Pas5Ssm, CAMPURI_PAS_5 } from "@/components/onboarding/pas-5-ssm";
import { Pas7Confirmare } from "@/components/onboarding/pas-7-confirmare";
import { RUTA_DUPA_AUTENTIFICARE } from "@/config/routes";
import type { OnboardeazaOrganizatieInput } from "@/schemas/organization";
import { completeazaFirmaSchema } from "@/schemas/organization";

import { completeazaDateleFirmei } from "./actions";

/**
 * Pasul 6 („Cont proprietar") lipsește: cine completează formularul ESTE
 * proprietarul. Rămâne în `ETICHETE_PASI` — e același catalog folosit și de
 * consolă — dar e ascuns aici, iar numerotarea afișată se recalculează.
 */
const PAS_PROPRIETAR = 6;
const PAS_CONFIRMARE = ETICHETE_PASI.length;

const CAMPURI_PAS: Readonly<Record<number, readonly (keyof OnboardeazaOrganizatieInput)[]>> = {
  1: CAMPURI_PAS_1 as readonly (keyof OnboardeazaOrganizatieInput)[],
  2: CAMPURI_PAS_2 as readonly (keyof OnboardeazaOrganizatieInput)[],
  3: CAMPURI_PAS_3 as readonly (keyof OnboardeazaOrganizatieInput)[],
  4: CAMPURI_PAS_4 as readonly (keyof OnboardeazaOrganizatieInput)[],
  5: CAMPURI_PAS_5 as readonly (keyof OnboardeazaOrganizatieInput)[],
};

/** Sare peste pasul proprietarului, în ambele sensuri. */
const urmatorul = (pas: number): number =>
  Math.min(PAS_CONFIRMARE, pas + 1 === PAS_PROPRIETAR ? pas + 2 : pas + 1);
const anteriorul = (pas: number): number =>
  Math.max(1, pas - 1 === PAS_PROPRIETAR ? pas - 2 : pas - 1);

type Props = Readonly<{
  numeFirma: string;
  valoriInitiale: Partial<OnboardeazaOrganizatieInput>;
}>;

export function AsistentFirma({ numeFirma, valoriInitiale }: Props) {
  const idFormular = useId();
  const router = useRouter();
  const [pasCurent, setPasCurent] = useState(1);
  const [eroareServer, setEroareServer] = useState<string | null>(null);

  const formular = useForm<OnboardeazaOrganizatieInput>({
    resolver: zodResolver(completeazaFirmaSchema),
    defaultValues: {
      platitor_tva: false,
      forma_juridica: "SRL",
      judet: "București",
      plata_avans: false,
      zile_concediu_anual_implicit: 20,
      cod_caen_secundare: [],
      ...valoriInitiale,
    },
  });
  const {
    handleSubmit,
    trigger,
    setError,
    formState: { isSubmitting },
  } = formular;

  const mergiInainte = async () => {
    const campuri = CAMPURI_PAS[pasCurent];
    // `shouldFocus` mută atenția pe primul câmp invalid — fără el, o eroare
    // aflată mai jos în pas trece neobservată și pare că „nu s-a întâmplat nimic".
    const valid = campuri === undefined || (await trigger(campuri, { shouldFocus: true }));
    if (valid) setPasCurent(urmatorul(pasCurent));
  };

  const trimite = handleSubmit(async (valori) => {
    setEroareServer(null);
    try {
      const raspuns = await completeazaDateleFirmei(valori);
      if (raspuns.ok) {
        // `refresh()` înainte de navigare: poarta din layout citește starea
        // firmei memoizat per request, iar fără reîmprospătare următoarea
        // pagină ar vedea tot `pending` și ne-ar trimite înapoi aici.
        router.refresh();
        router.replace(RUTA_DUPA_AUTENTIFICARE);
        return;
      }
      let primulPas: number | null = null;
      for (const [camp, mesaje] of Object.entries(raspuns.error.fieldErrors ?? {})) {
        const primul = mesaje[0];
        if (primul === undefined) continue;
        setError(camp as keyof OnboardeazaOrganizatieInput, { type: "server", message: primul });
        const pas = Number(
          Object.entries(CAMPURI_PAS).find(([, campuri]) =>
            (campuri as readonly string[]).includes(camp),
          )?.[0] ?? 1,
        );
        if (primulPas === null || pas < primulPas) primulPas = pas;
      }
      if (primulPas !== null) setPasCurent(primulPas);
      setEroareServer(raspuns.error.message);
    } catch (eroare) {
      // Fără acest catch, o cădere de rețea e o excepție nepreluată: butonul
      // iese din „Se salvează…", dar utilizatorul nu vede niciun motiv.
      console.error("[asistent-firma] trimite", eroare);
      setEroareServer(
        `Salvarea a eșuat neașteptat: ${eroare instanceof Error ? eroare.message : String(eroare)}. Reîncearcă.`,
      );
    }
  },
  // A DOUA funcție a lui `handleSubmit`: ce se întâmplă când validarea pică.
  // Fără ea, apăsarea pe „Finalizează" cu un câmp invalid pe un pas pe care
  // nu-l vezi nu face NIMIC — niciun mesaj, niciun apel, niciun indiciu. Cu
  // navigarea liberă între pași, situația a devenit ușor de nimerit.
  (erori) => {
    const campuriGresite = Object.keys(erori);
    const pasi = campuriGresite
      .map((camp) =>
        Number(
          Object.entries(CAMPURI_PAS).find(([, campuri]) =>
            (campuri as readonly string[]).includes(camp),
          )?.[0] ?? 0,
        ),
      )
      .filter((pas) => pas > 0);
    const primul = pasi.length > 0 ? Math.min(...pasi) : 1;
    setPasCurent(primul);
    setEroareServer(
      campuriGresite.length === 1
        ? "Un câmp obligatoriu lipsește sau e greșit. L-am deschis mai jos."
        : `${campuriGresite.length} câmpuri obligatorii lipsesc sau sunt greșite. Am deschis primul pas cu probleme.`,
    );
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-foreground text-2xl font-semibold">Bun venit</h1>
        <p className="text-muted-foreground text-sm">
          Înainte de a folosi aplicația, completează datele firmei{" "}
          <strong className="text-foreground font-medium">{numeFirma}</strong>. Sunt necesare pentru
          contracte, adeverințe și state de plată — fără ele, modulele care le folosesc nu pot
          lucra.
        </p>
      </header>

      <ProgresAsistent pasCurent={pasCurent} onSalt={setPasCurent} pasiAscunsi={[PAS_PROPRIETAR]} />

      {eroareServer !== null ? (
        <p
          role="alert"
          aria-live="assertive"
          className="border-border bg-surface text-danger rounded-md border px-4 py-3 text-sm"
        >
          {eroareServer}
        </p>
      ) : null}

      <form
        id={idFormular}
        onSubmit={(eveniment) => {
          eveniment.preventDefault();
          if (pasCurent === PAS_CONFIRMARE) void trimite();
        }}
        className="flex flex-col gap-6"
      >
        {pasCurent === 1 ? <Pas1Identitate formular={formular} idFormular={idFormular} /> : null}
        {pasCurent === 2 ? <Pas2Reprezentant formular={formular} idFormular={idFormular} /> : null}
        {pasCurent === 3 ? <Pas3Financiar formular={formular} idFormular={idFormular} /> : null}
        {pasCurent === 4 ? <Pas4Structura formular={formular} idFormular={idFormular} /> : null}
        {pasCurent === 5 ? <Pas5Ssm formular={formular} idFormular={idFormular} /> : null}
        {pasCurent === PAS_CONFIRMARE ? <Pas7Confirmare formular={formular} /> : null}

        <div className="border-border flex items-center justify-between gap-3 border-t pt-4">
          <button
            type="button"
            onClick={() => setPasCurent(anteriorul(pasCurent))}
            disabled={pasCurent === 1}
            className="border-border text-foreground hover:bg-surface rounded-md border px-4 py-2 text-sm font-medium transition disabled:opacity-40"
          >
            Înapoi
          </button>

          {pasCurent === PAS_CONFIRMARE ? (
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-5 py-2 text-sm font-semibold transition disabled:opacity-60"
            >
              {isSubmitting ? "Se salvează…" : "Finalizează configurarea"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void mergiInainte()}
              className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-5 py-2 text-sm font-semibold transition"
            >
              Continuă
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
