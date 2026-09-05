// src/app/(app)/angajati/nou/_components/asistent-angajat-nou.tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Buton, buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { RezumatErori } from "@/components/ui/rezumat-erori";
import { inroleazaAngajatSchema, type InroleazaAngajatInput } from "@/schemas/employee";
import { inroleazaAngajat, salveazaCiornaInrolare, stergeCiornaInrolare } from "../actions";
import { radacinaCampului, rezumatulErorilor } from "./erori-formular";
import { ProgresAsistent, ETICHETE_PASI } from "./progres-asistent";
import { Pas1Identitate, CAMPURI_PAS_1 } from "./pas-1-identitate";
import { Pas2Contact, CAMPURI_PAS_2 } from "./pas-2-contact";
import { Pas3Contract, CAMPURI_PAS_3 } from "./pas-3-contract";
import type { SablonSalarial } from "./pachet-salarial";
import { Pas4FisaPostului, CAMPURI_PAS_4 } from "./pas-4-fisa-postului";
import { Pas5BunuriCertificari, CAMPURI_PAS_5 } from "./pas-5-bunuri-certificari";
import { Pas6Confirmare } from "./pas-6-confirmare";

const TOTAL_PASI = ETICHETE_PASI.length;

const CAMPURI_PAS: readonly (readonly (keyof InroleazaAngajatInput)[])[] = [
  CAMPURI_PAS_1,
  CAMPURI_PAS_2,
  CAMPURI_PAS_3,
  CAMPURI_PAS_4,
  CAMPURI_PAS_5,
];

/** Ordinea în care omul parcurge câmpurile — folosită la sortarea rezumatului. */
const ORDINE_CAMPURI: readonly string[] = CAMPURI_PAS.flat();

function pasulPentruCamp(camp: string): number {
  const radacina = radacinaCampului(camp);
  const index = CAMPURI_PAS.findIndex((campuri) =>
    (campuri as readonly string[]).includes(radacina),
  );
  return index === -1 ? 1 : index + 1;
}

interface Optiune {
  readonly id: string;
  readonly denumire: string;
}

interface OptiuneAngajat {
  readonly id: string;
  readonly full_name: string;
}

interface OptiuneInventar {
  readonly id: string;
  readonly denumire: string;
  readonly numar_inventar: string;
}

interface Proprietati {
  readonly departamente: readonly Optiune[];
  readonly angajati: readonly OptiuneAngajat[];
  readonly puncteLucru: readonly Optiune[];
  readonly zileConcediuImplicit: number;
  readonly obiecteDisponibile: readonly OptiuneInventar[];
  /** Următorul număr liber de contract, doar ca text de ajutor. */
  readonly numarUrmator: string | null;
  /** Tipurile de componentă salarială ale firmei, pentru pachetul de la pasul 3. */
  readonly sabloaneSalariale: readonly SablonSalarial[];
  /**
   * Înrolarea neterminată a acestui utilizator, dacă există (0131).
   *
   * Datele NU sunt validate: o ciornă e incompletă prin definiție. Se toarnă
   * peste implicite, iar ce nu mai trece de schemă (un departament șters între
   * timp) cade la prima trecere de pas, cu mesajul lui.
   */
  readonly ciorna: {
    readonly pas: number;
    readonly date: Record<string, unknown>;
  } | null;
}

interface DocumentEmis {
  readonly cod: string;
  readonly denumire: string;
  readonly id: string;
  readonly numarAfisat: string;
}

interface RezultatSucces {
  readonly id: string;
  readonly nume: string;
  readonly numarContract: string;
  readonly documente: readonly DocumentEmis[];
  readonly invitatieTrimisaLa: string | null;
  readonly checklistPornit: string | null;
  readonly avertismente: readonly string[];
}

export function AsistentAngajatNou({
  departamente,
  angajati,
  puncteLucru,
  zileConcediuImplicit,
  obiecteDisponibile,
  numarUrmator,
  sabloaneSalariale,
  ciorna,
}: Proprietati) {
  const refFormular = useRef<HTMLFormElement | null>(null);
  const [pasCurent, setPasCurent] = useState(ciorna?.pas ?? 1);
  /**
   * Ciorna se salvează la fiecare trecere de pas, nu la fiecare tastă.
   *
   * Un debounce pe tastare ar fi scris CNP-ul în bază de zeci de ori pe minut,
   * pentru un câștig pe care trecerea de pas îl dă oricum: nimeni nu pierde
   * mai mult de un pas. `salvand` doar informează; eșecul ei NU blochează
   * înaintarea — ciorna e o plasă, nu o poartă.
   */
  const [stareCiorna, setStareCiorna] = useState<"initial" | "salvata" | "esuata">(
    ciorna === null ? "initial" : "salvata",
  );
  const [eroareServer, setEroareServer] = useState<string | null>(null);
  const [rezultat, setRezultat] = useState<RezultatSucces | null>(null);
  /**
   * Cât de larg e rezumatul de sub butoane.
   *
   * `null` — nu s-a încercat încă nimic, deci nu se arată nimic: un formular
   * proaspăt deschis nu-și reproșează câmpurile necompletate.
   * `"pas"` — s-a apăsat „Continuă”: doar câmpurile pasului curent.
   * `"tot"` — s-a apăsat „Înrolează angajatul”: tot formularul.
   */
  const [domeniuRezumat, setDomeniuRezumat] = useState<"pas" | "tot" | null>(null);
  /**
   * Cererea de focus: numele câmpului într-un `ref`, declanșatorul într-un
   * contor.
   *
   * NU o stare care se golește din efect — React Compiler o respinge
   * (`react-hooks/set-state-in-effect`), fiindcă un `setState` sincron în corpul
   * unui efect produce randări în cascadă. Contorul se schimbă o dată per
   * cerere, efectul rulează o dată, și nu scrie nimic înapoi.
   */
  const campDeFocusat = useRef<string | null>(null);
  const [cerereFocus, setCerereFocus] = useState(0);

  const ceriFocus = (camp: string) => {
    campDeFocusat.current = camp;
    setCerereFocus((n) => n + 1);
  };

  const formular = useForm<InroleazaAngajatInput>({
    resolver: zodResolver(inroleazaAngajatSchema),
    defaultValues: {
      gen: "nedeclarat",
      cetatenie: "RO",
      nr_persoane_intretinere: 0,
      optiune_pilon_ii: true,
      is_primary: true,
      conditii_munca: "normale",
      contract_duration: "nedeterminat",
      norma_ore_saptamana: 40,
      norma_ore_zi: 8,
      work_mode: "sediu",
      moneda: "RON",
      zile_concediu_anual: zileConcediuImplicit,
      examen_tip: "angajare",
      examen_rezultat: "apt",
      /*
       * Ciorna se toarnă PESTE implicite, nu invers: ce a scris omul bate ce
       * propune aplicația. Un `zile_concediu_anual` schimbat de el la 25 nu
       * are voie să revină la implicitul firmei doar fiindcă a închis fila.
       *
       * Datele NU sunt validate aici — o ciornă e incompletă prin definiție.
       * Ce nu mai trece de schemă (un departament dezactivat între timp) cade
       * la prima trecere de pas, cu mesajul lui.
       */
      ...(ciorna?.date ?? {}),
    },
  });
  const {
    handleSubmit,
    trigger,
    setError,
    formState: { isSubmitting, errors },
  } = formular;

  /**
   * Focusul se mută DUPĂ randare, nu în clipa clicului.
   *
   * Câmpul vinovat poate fi pe un pas care nu era montat: pașii se randează
   * condiționat, iar `focus()` pe un element inexistent nu face nimic — exact
   * defectul lui `handleSubmit` fără `onInvalid`, unde `_focusError()` al lui
   * react-hook-form nu găsea nimic de focusat pe pasul 6, care n-are inputuri.
   * Se schimbă întâi pasul, apoi efectul ăsta găsește controlul deja montat.
   */
  useEffect(() => {
    const camp = campDeFocusat.current;
    if (camp === null) return;
    const element = refFormular.current?.querySelector<HTMLElement>(`[name="${CSS.escape(camp)}"]`);
    element?.focus();
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [cerereFocus]);

  /**
   * Scrie ciorna. Nu aruncă și nu blochează: o salvare căzută înseamnă că omul
   * pierde pașii dacă închide fila, nu că nu poate continua acum.
   */
  const salveazaCiorna = async (pasNou: number) => {
    const valori = formular.getValues();
    const nume = [valori.first_name, valori.last_name].filter(Boolean).join(" ").trim();
    const raspuns = await salveazaCiornaInrolare({
      pas: pasNou,
      eticheta: nume.length === 0 ? null : nume,
      date: valori as unknown as Record<string, unknown>,
    });
    setStareCiorna(raspuns.ok ? "salvata" : "esuata");
  };

  const mergiInainte = async () => {
    const campuriPas = CAMPURI_PAS[pasCurent - 1];
    if (campuriPas === undefined || (await trigger(campuriPas))) {
      setDomeniuRezumat(null);
      const pasNou = Math.min(TOTAL_PASI, pasCurent + 1);
      setPasCurent(pasNou);
      void salveazaCiorna(pasNou);
      return;
    }
    // Ramura care lipsea. Fără ea, butonul pur și simplu nu făcea nimic.
    setDomeniuRezumat("pas");
    const primul = rezumatulErorilor(formular.formState.errors, ORDINE_CAMPURI, campuriPas)[0];
    if (primul !== undefined) ceriFocus(primul.camp);
  };

  const mergiInapoi = () => setPasCurent((p) => Math.max(1, p - 1));

  const laValidare = async (valori: InroleazaAngajatInput) => {
    setEroareServer(null);
    const raspuns = await inroleazaAngajat(valori);
    if (raspuns.ok) {
      // Ciorna și-a terminat treaba. Lăsată acolo, ar fi reapărut la următoarea
      // înrolare ca „ai o înrolare neterminată" pentru un om deja angajat.
      void stergeCiornaInrolare({});
      setRezultat({
        id: raspuns.data.id,
        nume: `${valori.first_name} ${valori.last_name}`.trim(),
        numarContract: raspuns.data.numarContract,
        documente: raspuns.data.documente,
        invitatieTrimisaLa: raspuns.data.invitatieTrimisaLa,
        checklistPornit: raspuns.data.checklistPornit,
        avertismente: raspuns.data.avertismente,
      });
      return;
    }
    const erori = Object.entries(raspuns.error.fieldErrors ?? {});
    let primulPas: number | null = null;
    for (const [camp, mesaje] of erori) {
      const primul = mesaje[0];
      if (!primul) continue;
      setError(camp as keyof InroleazaAngajatInput, { type: "server", message: primul });
      const pasCamp = pasulPentruCamp(camp);
      if (primulPas === null || pasCamp < primulPas) primulPas = pasCamp;
    }
    if (primulPas !== null) setPasCurent(primulPas);
    setDomeniuRezumat(erori.length > 0 ? "tot" : null);
    setEroareServer(raspuns.error.message);
  };

  /**
   * Ramura de eșec a trimiterii finale.
   *
   * `handleSubmit` era chemat fără ea, iar pasul 6 nu montează niciun input —
   * deci clicul pe „Înrolează angajatul” nu producea nimic: nici mesaj, nici
   * schimbare de pas. Aici se sare la pasul câmpului vinovat, apoi se
   * focusează.
   */
  const laInvalidare = (erori: FieldErrors<InroleazaAngajatInput>) => {
    setDomeniuRezumat("tot");
    const primul = rezumatulErorilor(erori, ORDINE_CAMPURI, null)[0];
    if (primul === undefined) return;
    setPasCurent(pasulPentruCamp(primul.camp));
    ceriFocus(primul.camp);
  };

  const campuriPasCurent = CAMPURI_PAS[pasCurent - 1];
  const eroriAfisate =
    domeniuRezumat === null
      ? []
      : rezumatulErorilor(
          errors,
          ORDINE_CAMPURI,
          domeniuRezumat === "pas" ? ((campuriPasCurent ?? []) as readonly string[]) : null,
        );

  const sariLaCamp = (camp: string) => {
    setPasCurent(pasulPentruCamp(camp));
    ceriFocus(camp);
  };

  if (rezultat !== null) {
    return (
      <div className="border-border bg-surface rounded-panou space-y-4 border p-6">
        <h2 className="text-foreground text-sectiune font-semibold">
          „{rezultat.nume}” a fost înrolat(ă)
        </h2>
        <p className="text-muted-foreground text-corp">
          Contractul <strong className="text-foreground">nr. {rezultat.numarContract}</strong> e
          activ, marca a fost atribuită automat, iar soldul de concediu a fost însămânțat pentru
          toate tipurile organizației.
        </p>

        {/* Lanțul, pas cu pas: ce a mers de la sine. Ce n-a mers stă mai jos,
            în avertismente — separate, ca să nu se citească drept același lucru. */}
        <ul className="text-corp space-y-1">
          {rezultat.invitatieTrimisaLa !== null ? (
            <li className="text-muted-foreground">
              Invitația de acces a plecat la{" "}
              <span className="text-foreground">{rezultat.invitatieTrimisaLa}</span>. Contul se
              creează când angajatul acceptă și își pune parola, și se leagă singur de fișa asta.
            </li>
          ) : null}
          {rezultat.checklistPornit !== null ? (
            <li className="text-muted-foreground">
              Checklistul de integrare{" "}
              <span className="text-foreground">„{rezultat.checklistPornit}”</span> a pornit.
            </li>
          ) : null}
        </ul>

        {rezultat.documente.length > 0 ? (
          <div className="border-border rounded-panou border p-4">
            <p className="text-foreground text-corp font-medium">
              {rezultat.documente.length === 1
                ? "Un document generat"
                : `${String(rezultat.documente.length)} documente generate`}
            </p>
            <ul className="mt-2 space-y-1">
              {rezultat.documente.map((document) => (
                <li key={document.id} className="text-corp flex flex-wrap items-baseline gap-2">
                  <Link
                    href={`/documente/${document.id}?format=pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline decoration-1 underline-offset-4 hover:decoration-2"
                  >
                    {document.denumire}
                  </Link>
                  <span className="text-muted-foreground text-nota">{document.numarAfisat}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-nota mt-3">
              Se descarcă în PDF. Toate stau și pe fișa angajatului, la Documente.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link href={`/angajati/${rezultat.id}`} className={buton({ varianta: "primar" })}>
            Deschide fișa angajatului
          </Link>
          {rezultat.documente.length > 1 ? (
            <Link
              href={`/angajati/${rezultat.id}/documente`}
              className={buton({ varianta: "secundar" })}
            >
              Toate documentele
            </Link>
          ) : null}
        </div>

        {rezultat.avertismente.length > 0 ? (
          <Callout
            fel="atentie"
            className="mt-6"
            titlu={`Angajatul e înrolat, dar ${
              rezultat.avertismente.length === 1 ? "un pas nu s-a" : "câțiva pași nu s-au"
            } putut face automat:`}
          >
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {rezultat.avertismente.map((avertisment, indice) => (
                // Cheia include indicele: două documente pot eșua pe aceeași
                // variabilă lipsă și produc mesaje identice.
                <li key={`${String(indice)}-${avertisment}`}>{avertisment}</li>
              ))}
            </ul>
          </Callout>
        ) : null}
      </div>
    );
  }

  return (
    <form
      ref={refFormular}
      // `handleSubmit(...)` se cheamă la EVENIMENT, nu la randare: apelat în
      // corpul componentei, React Compiler îl respinge
      // (`react-hooks/refs`) — `laInvalidare` închide peste un `ref`, iar
      // compilatorul nu poate dovedi că nu-l citește în timpul randării.
      onSubmit={(eveniment) => {
        void handleSubmit(laValidare, laInvalidare)(eveniment);
      }}
      noValidate
      className="space-y-6"
    >
      <ProgresAsistent pasCurent={pasCurent} />

      {/* Starea ciornei, lângă progres. Nu e un buton și nu cere nimic: spune
          doar dacă închiderea filei costă sau nu. „Nesalvată" e informația care
          contează — cealaltă e liniștitoare, dar nu acționabilă. */}
      {stareCiorna === "initial" ? null : (
        <p
          className={
            stareCiorna === "salvata" ? "text-corp-mic text-secundar" : "text-corp-mic text-danger"
          }
        >
          {stareCiorna === "salvata"
            ? "Înrolarea e salvată ca ciornă — o puteți relua de pe orice dispozitiv, în 30 de zile."
            : "Ciorna nu s-a putut salva. Puteți continua, dar nu închideți fila: pașii completați s-ar pierde."}
        </p>
      )}

      {eroareServer !== null && eroriAfisate.length === 0 ? (
        // Mesajul general apare DOAR când nu e deja pe un câmp — altfel omul
        // citește aceeași propoziție de două ori. Aceeași regulă ca în
        // `src/components/ui/formular.tsx`.
        <Callout fel="eroare">{eroareServer}</Callout>
      ) : null}

      {pasCurent === 1 && <Pas1Identitate formular={formular} />}
      {pasCurent === 2 && <Pas2Contact formular={formular} />}
      {pasCurent === 3 && (
        <Pas3Contract
          formular={formular}
          departamente={departamente}
          angajati={angajati}
          puncteLucru={puncteLucru}
          numarUrmator={numarUrmator}
          sabloaneSalariale={sabloaneSalariale}
        />
      )}
      {pasCurent === 4 && <Pas4FisaPostului formular={formular} />}
      {pasCurent === 5 && (
        <Pas5BunuriCertificari formular={formular} obiecteDisponibile={obiecteDisponibile} />
      )}
      {pasCurent === 6 && <Pas6Confirmare formular={formular} />}

      {/* Rezumatul stă LÂNGĂ butoane, nu în capul paginii: acolo se uită omul
          în clipa în care apasă „Continuă”. */}
      <RezumatErori erori={eroriAfisate} laSelectare={sariLaCamp} />

      <div className="flex items-center gap-3">
        {pasCurent > 1 && (
          <Buton varianta="secundar" onClick={mergiInapoi}>
            Înapoi
          </Buton>
        )}
        {pasCurent < TOTAL_PASI ? (
          <Buton varianta="primar" onClick={mergiInainte}>
            Continuă
          </Buton>
        ) : (
          <Buton type="submit" varianta="primar" inCurs={isSubmitting} textInCurs="Se înrolează…">
            Înrolează angajatul
          </Buton>
        )}
        <p aria-live="polite" className="text-muted-foreground text-corp">
          {isSubmitting ? "Se salvează datele…" : ""}
        </p>
      </div>
    </form>
  );
}
