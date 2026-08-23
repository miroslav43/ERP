// src/app/(app)/angajati/nou/_components/asistent-angajat-nou.tsx
"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Buton, buton } from "@/components/ui/buton";
import { inroleazaAngajatSchema, type InroleazaAngajatInput } from "@/schemas/employee";
import { inroleazaAngajat } from "../actions";
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

function pasulPentruCamp(camp: string): number {
  const index = CAMPURI_PAS.findIndex((campuri) => (campuri as readonly string[]).includes(camp));
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
  const idFormular = useId();
  const [pasCurent, setPasCurent] = useState(1);
  const [eroareServer, setEroareServer] = useState<string | null>(null);
  const [rezultat, setRezultat] = useState<RezultatSucces | null>(null);

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
    formState: { isSubmitting },
  } = formular;

  const mergiInainte = async () => {
    const campuriPas = CAMPURI_PAS[pasCurent - 1];
    const valid = campuriPas === undefined || (await trigger(campuriPas));
    if (valid) setPasCurent((p) => Math.min(TOTAL_PASI, p + 1));
  };
  const mergiInapoi = () => setPasCurent((p) => Math.max(1, p - 1));

  const trimite = handleSubmit(async (valori) => {
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
    setEroareServer(raspuns.error.message);
  });

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
          <div
            role="alert"
            className="border-warning/40 bg-warning/10 rounded-panou mt-6 border p-4 text-left"
          >
            <p className="text-corp font-medium">
              Angajatul e înrolat, dar{" "}
              {rezultat.avertismente.length === 1 ? "un pas nu s-a" : "câțiva pași nu s-au"} putut
              face automat:
            </p>
            <ul className="text-corp mt-2 list-disc space-y-1 pl-5">
              {rezultat.avertismente.map((avertisment) => (
                <li key={avertisment}>{avertisment}</li>
              ))}
            </ul>
          </div>
        ) : null}
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
            className="border-border bg-surface text-danger rounded-control text-corp border p-3"
          >
            {eroareServer}
          </p>
        )}
      </div>

      {pasCurent === 1 && <Pas1Identitate formular={formular} idFormular={idFormular} />}
      {pasCurent === 2 && <Pas2Contact formular={formular} idFormular={idFormular} />}
      {pasCurent === 3 && (
        <Pas3Contract
          formular={formular}
          idFormular={idFormular}
          departamente={departamente}
          functii={functii}
          angajati={angajati}
        />
      )}
      {pasCurent === 4 && <Pas4FisaPostului formular={formular} idFormular={idFormular} />}
      {pasCurent === 5 && (
        <Pas5BunuriCertificari
          formular={formular}
          idFormular={idFormular}
          obiecteDisponibile={obiecteDisponibile}
        />
      )}
      {pasCurent === 6 && <Pas6Confirmare formular={formular} />}

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
