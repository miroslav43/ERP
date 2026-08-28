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
import { inroleazaAngajat } from "../actions";
import { radacinaCampului, rezumatulErorilor } from "./erori-formular";
import { ProgresAsistent, ETICHETE_PASI } from "./progres-asistent";
import { Pas1Identitate, CAMPURI_PAS_1 } from "./pas-1-identitate";
import { Pas2Contact, CAMPURI_PAS_2 } from "./pas-2-contact";
import { Pas3Contract, CAMPURI_PAS_3 } from "./pas-3-contract";
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
  readonly functii: readonly Optiune[];
  readonly angajati: readonly OptiuneAngajat[];
  readonly zileConcediuImplicit: number;
  readonly obiecteDisponibile: readonly OptiuneInventar[];
}

interface RezultatSucces {
  readonly id: string;
  readonly nume: string;
  readonly documentContractId: string | null;
  readonly documentFisaPostuluiId: string | null;
  readonly avertismente: readonly string[];
}

export function AsistentAngajatNou({
  departamente,
  functii,
  angajati,
  zileConcediuImplicit,
  obiecteDisponibile,
}: Proprietati) {
  const refFormular = useRef<HTMLFormElement | null>(null);
  const [pasCurent, setPasCurent] = useState(1);
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

  const mergiInainte = async () => {
    const campuriPas = CAMPURI_PAS[pasCurent - 1];
    if (campuriPas === undefined || (await trigger(campuriPas))) {
      setDomeniuRezumat(null);
      setPasCurent((p) => Math.min(TOTAL_PASI, p + 1));
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
      setRezultat({
        id: raspuns.data.id,
        nume: `${valori.first_name} ${valori.last_name}`.trim(),
        documentContractId: raspuns.data.documentContractId,
        documentFisaPostuluiId: raspuns.data.documentFisaPostuluiId,
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
          Marca a fost atribuită automat, contractul e activ, iar soldul de concediu a fost
          însămânțat pentru toate tipurile organizației.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={`/angajati/${rezultat.id}`} className={buton({ varianta: "primar" })}>
            Deschide fișa angajatului
          </Link>
          {rezultat.documentContractId !== null ? (
            <Link
              href={`/documente/${rezultat.documentContractId}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buton({ varianta: "secundar" })}
            >
              Vezi contractul de muncă
            </Link>
          ) : null}
          {rezultat.documentFisaPostuluiId !== null ? (
            <Link
              href={`/documente/${rezultat.documentFisaPostuluiId}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buton({ varianta: "secundar" })}
            >
              Vezi fișa postului
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
          functii={functii}
          angajati={angajati}
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
