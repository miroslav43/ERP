"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ETICHETE_PASI, ProgresAsistent } from "@/components/onboarding/progres-asistent";
import { Pas1Identitate, CAMPURI_PAS_1 } from "@/components/onboarding/pas-1-identitate";
import { Pas2Reprezentant, CAMPURI_PAS_2 } from "@/components/onboarding/pas-2-reprezentant";
import { Pas3Financiar, CAMPURI_PAS_3 } from "@/components/onboarding/pas-3-financiar";
import { Pas4Structura, CAMPURI_PAS_4 } from "@/components/onboarding/pas-4-structura";
import { Pas5Ssm, CAMPURI_PAS_5 } from "@/components/onboarding/pas-5-ssm";
import { Pas7Confirmare } from "@/components/onboarding/pas-7-confirmare";
import { AlegerePatronAngajat } from "./alegere-patron-angajat";
import { Buton } from "@/components/ui/buton";
import { RUTA_DUPA_AUTENTIFICARE } from "@/config/routes";
import { citesteDepozit, scrieDepozit, stergeDepozit } from "@/lib/ui/depozit-sesiune";
import type { OnboardeazaOrganizatieInput } from "@/schemas/organization";
import { completeazaFirmaSchema } from "@/schemas/organization";

import { completeazaDateleFirmei } from "./actions";
import {
  VERSIUNE_CIORNA,
  curataPentruCiorna,
  esteCiornaValida,
  pasDinUrl,
  type Ciorna,
} from "./ciorna";

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

type ModIstoric = "push" | "replace";

/**
 * Scrie pasul în adresă, ca `?pas=N`, cu API-ul nativ al istoricului.
 *
 * Nativ, nu `router.push`: Next integrează `pushState`/`replaceState` cu
 * routerul (sincronizează `useSearchParams`), dar NU re-cere pagina de pe
 * server — iar pagina de aici face două interogări la fiecare randare. `push`
 * pune o intrare în istoric (Back-ul browserului revine la pasul anterior, în
 * loc să părăsească asistentul — QA ONB-012); `replace` o înlocuiește, pentru
 * salturile pe care nu le-a cerut omul (o eroare care deschide primul pas cu
 * probleme, restaurarea ciornei).
 */
function scriePasulInAdresa(pas: number, mod: ModIstoric): void {
  window.history[mod === "push" ? "pushState" : "replaceState"]({ pas }, "", `?pas=${pas}`);
}

/** Pasul din adresa curentă — sursa de adevăr după Back/Forward. */
function pasulDinAdresa(): number {
  return pasDinUrl(new URLSearchParams(window.location.search).get("pas"));
}

/** Ciorna din `sessionStorage`: pasul plus câmpurile permise (fără CNP, prin construcție). */
function salveazaCiorna(
  cheie: string,
  pas: number,
  valori: Partial<OnboardeazaOrganizatieInput>,
): void {
  scrieDepozit<Ciorna>(cheie, { v: VERSIUNE_CIORNA, pas, date: curataPentruCiorna(valori) });
}

type Props = Readonly<{
  numeFirma: string;
  valoriInitiale: Partial<OnboardeazaOrganizatieInput>;
  /**
   * Cheia ciornei din `sessionStorage` — include utilizatorul și firma, deci
   * alt cont în aceeași filă nu primește datele altcuiva. Vine din `page.tsx`.
   */
  cheieCiorna: string;
}>;

export function AsistentFirma({ numeFirma, valoriInitiale, cheieCiorna }: Props) {
  const idFormular = useId();
  const router = useRouter();
  const parametri = useSearchParams();
  /**
   * Pasul pornește din `?pas=N`, nu de la 1. Pe ruta `force-dynamic`
   * `useSearchParams` e disponibil și la randarea pe server, deci HTML-ul și
   * clientul pornesc pe același pas — fără nepotrivire de hidratare. Dacă
   * cineva scoate `dynamic` din `page.tsx`, pasul inițial diferă între HTML și
   * client și React aruncă la hidratare.
   */
  const [pasCurent, setPasCurent] = useState(() => pasDinUrl(parametri.get("pas")));
  // Oglinda pasului pentru abonamentul la valori, care nu se re-creează la
  // fiecare pas, și pentru ascultătorul de `popstate`.
  const refPas = useRef(pasCurent);
  /**
   * Pus pe `true` înainte de ștergerea ciornei. Abonamentul la valori primește
   * și emisiile de stare de DUPĂ `handleSubmit` (`isSubmitted`, `submitCount`),
   * care altfel ar rescrie ciorna tocmai ștearsă — datele firmei ar rămâne în
   * filă după ce au ajuns în bază.
   */
  const refFinalizat = useRef(false);
  const [eroareServer, setEroareServer] = useState<string | null>(null);
  const [recuperata, setRecuperata] = useState(false);

  const formular = useForm<OnboardeazaOrganizatieInput>({
    // Formularul rămâne tipat pe forma COMPLETĂ (pașii 1–5 sunt componente
    // comune cu asistentul din consola de platformă, care are și pasul 6), dar
    // schema de aici NU mai cere `owner_*`: proprietarul e chiar apelantul și
    // pasul lui e sărit. Validarea rulează pe schema îngustă; câmpurile lipsă
    // nu pot pica (QA 8 oct 2026, ONB-010), iar la trimitere nu sunt transmise.
    resolver: zodResolver(
      completeazaFirmaSchema,
    ) as unknown as Resolver<OnboardeazaOrganizatieInput>,
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
    getValues,
    reset,
    subscribe,
    formState: { isSubmitting },
  } = formular;

  /**
   * Singurul loc care schimbă pasul. Golește bannerul (QA ONB-018a: rămânea
   * vizibil pe pașii următori), scrie adresa și salvează ciorna cu pasul nou —
   * ca la reîncărcare asistentul să se deschidă exact unde a rămas omul.
   */
  const schimbaPasul = (pasNou: number, mod: ModIstoric): void => {
    setEroareServer(null);
    setPasCurent(pasNou);
    refPas.current = pasNou;
    scriePasulInAdresa(pasNou, mod);
    salveazaCiorna(cheieCiorna, pasNou, getValues());
  };

  // Back/Forward: adresa s-a schimbat deja, pasul o urmează. `setState` într-un
  // handler, nu în corpul efectului — lint-ul respinge `setState` sincron în efect.
  useEffect(() => {
    const laIstoric = (): void => {
      const pas = pasulDinAdresa();
      refPas.current = pas;
      setPasCurent(pas);
    };
    window.addEventListener("popstate", laIstoric);
    return () => {
      window.removeEventListener("popstate", laIstoric);
    };
  }, []);

  /**
   * Restaurarea ciornei, o singură dată, după montare — în `requestAnimationFrame`,
   * exact ca în `(vitrina)/vitrina/leave/vitrina-leave.tsx`: starea inițială e
   * ce a randat serverul, depozitul se citește după hidratare.
   *
   * `keepDefaultValues: true` lasă valorile implicite neatinse, deci câmpurile
   * recuperate ies `dirty` — intenționat: `poateScrie` din `camp-cui-anaf.tsx`
   * nu le suprascrie la un nou „Preia de la ANAF". Datele ANAF au intrat în
   * ciornă la prima preluare; reîncărcarea nu mai apelează registrul.
   *
   * Adresa bate ciorna: dacă omul a deschis `?pas=2`, acolo rămâne; doar fără
   * `?pas` se deschide pasul la care a rămas, prin `replace`.
   */
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const ciorna = citesteDepozit<Ciorna | null>(cheieCiorna, null, esteCiornaValida);
      if (ciorna === null) return;
      if (new URLSearchParams(window.location.search).get("pas") === null) {
        refPas.current = ciorna.pas;
        setPasCurent(ciorna.pas);
        scriePasulInAdresa(ciorna.pas, "replace");
      }
      reset({ ...getValues(), ...ciorna.date }, { keepDefaultValues: true });
      setRecuperata(true);
    });
    return () => {
      cancelAnimationFrame(id);
    };
  }, [cheieCiorna, getValues, reset]);

  /**
   * Salvare la ORICE schimbare, nu doar la „Continuă": scenariul QA e „Preia
   * de la ANAF", e-mail, adresă, apoi F5 — fără să fi apăsat nimic. `subscribe`
   * nu re-randează componenta; scrierea e sincronă și sub 3 KB, fără debounce.
   * CNP-ul nu ajunge în depozit: `curataPentruCiorna` îl taie prin construcție.
   */
  useEffect(
    () =>
      subscribe({
        formState: { values: true },
        callback: ({ values }) => {
          if (refFinalizat.current) return;
          salveazaCiorna(cheieCiorna, refPas.current, values);
        },
      }),
    [cheieCiorna, subscribe],
  );

  const mergiInainte = async () => {
    const campuri = CAMPURI_PAS[pasCurent];
    // `shouldFocus` mută atenția pe primul câmp invalid — fără el, o eroare
    // aflată mai jos în pas trece neobservată și pare că „nu s-a întâmplat nimic".
    const valid = campuri === undefined || (await trigger(campuri, { shouldFocus: true }));
    if (valid) schimbaPasul(urmatorul(pasCurent), "push");
  };

  /**
   * Saltul din stepper. Înapoi e liber. Înainte validează fiecare pas sărit și
   * se oprește la primul nevalid (QA ONB-018b: „Confirmare" ocolea validarea,
   * iar „Finalizează" arunca apoi la pasul 1 fără explicație). Navigarea
   * rămâne liberă — nu se limitează la pașii deja atinși — dar nu mai minte.
   */
  const saltLaPas = async (tinta: number) => {
    if (tinta === pasCurent) return;
    if (tinta < pasCurent) {
      schimbaPasul(tinta, "push");
      return;
    }
    for (let pas = pasCurent; pas < tinta; pas = urmatorul(pas)) {
      const campuri = CAMPURI_PAS[pas];
      const valid = campuri === undefined || (await trigger(campuri, { shouldFocus: true }));
      if (valid) continue;
      // `schimbaPasul` golește bannerul, deci mesajul se pune DUPĂ el.
      if (pas !== pasCurent) schimbaPasul(pas, "push");
      setEroareServer(
        `Completați pasul „${ETICHETE_PASI[pas - 1] ?? ""}” înainte de a sări mai departe.`,
      );
      return;
    }
    schimbaPasul(tinta, "push");
  };

  /**
   * Răspunsul la „sunteți și angajat?". NU se persistă — vezi antetul
   * componentei: decide doar unde ajunge omul după „Finalizează", iar starea
   * reală (are contract sau nu) e oricum în bază.
   */
  const [esteAngajat, setEsteAngajat] = useState<boolean | null>(null);

  /**
   * Cele două brațe ale lui `handleSubmit`. Sunt funcții simple, iar
   * `handleSubmit(laValidare, laInvalidare)` se cheamă la EVENIMENT, în
   * `onSubmit`, nu aici în corpul componentei: amândouă închid peste ref-uri
   * (`refFinalizat`, `refPas` prin `schimbaPasul`), iar React Compiler respinge
   * (`react-hooks/refs`) trecerea lor către o funcție apelată la randare — nu
   * poate dovedi că nu le citește atunci. Același tipar ca în
   * `angajati/nou/_components/asistent-angajat-nou.tsx`.
   */
  const laValidare = async (valori: OnboardeazaOrganizatieInput): Promise<void> => {
    setEroareServer(null);
    try {
      const raspuns = await completeazaDateleFirmei(valori);
      if (raspuns.ok) {
        // Ciorna și-a făcut treaba: datele sunt în bază. Rămasă în filă, ar
        // reapărea la următoarea firmă `pending` a aceluiași cont.
        refFinalizat.current = true;
        stergeDepozit(cheieCiorna);
        // `refresh()` înainte de navigare: poarta din layout citește starea
        // firmei memoizat per request, iar fără reîmprospătare următoarea
        // pagină ar vedea tot `pending` și ne-ar trimite înapoi aici.
        router.refresh();
        /*
         * „Da, sunt și angajat" duce direct în înrolare, nu pe panou.
         *
         * Nu se poate face aici mai mult decât o rutare: contractul cere CNP,
         * act de identitate, adresă și salariu — cele paisprezece câmpuri
         * obligatorii ale înrolării, pe care un pas de asistent n-are cum să
         * le strângă fără să dubleze tot formularul. Alegerea îl duce acolo
         * unde ele se completează, cu numele deja pus.
         */
        router.replace(esteAngajat === true ? "/angajati/nou?eu=1" : RUTA_DUPA_AUTENTIFICARE);
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
      // `replace`, nu `push`: saltul nu l-a cerut omul, nu îngroașă istoricul.
      // Mesajul serverului se pune DUPĂ, fiindcă `schimbaPasul` golește bannerul.
      if (primulPas !== null) schimbaPasul(primulPas, "replace");
      setEroareServer(raspuns.error.message);
    } catch (eroare) {
      // Fără acest catch, o cădere de rețea e o excepție nepreluată: butonul
      // iese din „Se salvează…", dar utilizatorul nu vede niciun motiv.
      console.error("[asistent-firma] trimite", eroare);
      setEroareServer(
        `Salvarea a eșuat neașteptat: ${eroare instanceof Error ? eroare.message : String(eroare)}. Reîncearcă.`,
      );
    }
  };

  // A DOUA funcție a lui `handleSubmit`: ce se întâmplă când validarea pică.
  // Fără ea, apăsarea pe „Finalizează" cu un câmp invalid pe un pas pe care
  // nu-l vezi nu face NIMIC — niciun mesaj, niciun apel, niciun indiciu. Cu
  // navigarea liberă între pași, situația a devenit ușor de nimerit.
  const laInvalidare = (erori: FieldErrors<OnboardeazaOrganizatieInput>): void => {
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
    schimbaPasul(primul, "replace");
    setEroareServer(
      campuriGresite.length === 1
        ? "Un câmp obligatoriu lipsește sau e greșit. L-am deschis mai jos."
        : `${campuriGresite.length} câmpuri obligatorii lipsesc sau sunt greșite. Am deschis primul pas cu probleme.`,
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-foreground text-titlu font-semibold">Bun venit</h1>
        <p className="text-muted-foreground text-corp">
          Înainte de a folosi aplicația, completează datele firmei{" "}
          <strong className="text-foreground font-medium">{numeFirma}</strong>. Sunt necesare pentru
          contracte, adeverințe și state de plată — fără ele, modulele care le folosesc nu pot
          lucra.
        </p>
      </header>

      <ProgresAsistent
        pasCurent={pasCurent}
        onSalt={(pas) => void saltLaPas(pas)}
        pasiAscunsi={[PAS_PROPRIETAR]}
      />

      {recuperata ? (
        <p
          role="status"
          className="border-border bg-surface text-muted-foreground rounded-control text-corp border px-4 py-3"
        >
          Am recuperat datele completate anterior în această filă. CNP-ul reprezentantului legal nu
          se păstrează în ciornă — reintroduceți-l la pasul „Reprezentant legal”, dacă e cazul.
        </p>
      ) : null}

      {eroareServer !== null ? (
        <p
          role="alert"
          aria-live="assertive"
          className="border-border bg-surface text-danger rounded-control text-corp border px-4 py-3"
        >
          {eroareServer}
        </p>
      ) : null}

      {/* `noValidate`, ca în asistentul din consolă. Pașii sunt ACELEAȘI
          componente în ambele zone; de când câmpurile obligatorii poartă
          `required` (prin `<Camp obligatoriu>`), un formular fără `noValidate`
          ar fi fost oprit de validarea nativă a browserului ÎNAINTE ca
          `onSubmit` să se declanșeze — cu bula browserului, în limba
          browserului, în locul mesajelor românești din Zod. Aceleași câmpuri
          s-ar fi comportat diferit în cele două zone. Validarea rămâne
          `zodResolver`; `required` rămâne în DOM fiindcă cititoarele de ecran
          îl anunță. */}
      <form
        id={idFormular}
        noValidate
        onSubmit={(eveniment) => {
          // `handleSubmit(...)` face singur `preventDefault`; pe pașii
          // intermediari Enter într-un câmp nu trimite nimic.
          if (pasCurent !== PAS_CONFIRMARE) {
            eveniment.preventDefault();
            return;
          }
          void handleSubmit(laValidare, laInvalidare)(eveniment);
        }}
        className="flex flex-col gap-6"
      >
        {pasCurent === 1 ? <Pas1Identitate formular={formular} idFormular={idFormular} /> : null}
        {pasCurent === 2 ? <Pas2Reprezentant formular={formular} idFormular={idFormular} /> : null}
        {pasCurent === 3 ? <Pas3Financiar formular={formular} idFormular={idFormular} /> : null}
        {pasCurent === 4 ? <Pas4Structura formular={formular} idFormular={idFormular} /> : null}
        {pasCurent === 5 ? <Pas5Ssm formular={formular} idFormular={idFormular} /> : null}
        {pasCurent === PAS_CONFIRMARE ? (
          <>
            <Pas7Confirmare formular={formular} />
            {/* Sub recapitulare, nu deasupra: întâi verifici ce ai completat,
                apoi răspunzi la ultima întrebare. */}
            <div className="mt-6">
              <AlegerePatronAngajat valoare={esteAngajat} laSchimbare={setEsteAngajat} />
            </div>
          </>
        ) : null}

        <div className="border-border flex items-center justify-between gap-3 border-t pt-4">
          <Buton
            varianta="secundar"
            onClick={() => schimbaPasul(anteriorul(pasCurent), "push")}
            disabled={pasCurent === 1}
          >
            Înapoi
          </Buton>

          {pasCurent === PAS_CONFIRMARE ? (
            <Buton varianta="primar" type="submit" inCurs={isSubmitting} textInCurs="Se salvează…">
              Finalizează configurarea
            </Buton>
          ) : (
            <Buton varianta="primar" onClick={() => void mergiInainte()}>
              Continuă
            </Buton>
          )}
        </div>
      </form>
    </div>
  );
}
