// src/app/(app)/inventar/[id]/actiuni-obiect.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Camp } from "@/components/ui/camp";
import { STARI_OBIECT } from "@/schemas/inventory";
import { ETICHETE_STARE } from "../etichete";
import { actualizeazaObiect, caseazaObiect } from "../actions";

interface OptiuneCategorie {
  readonly id: string;
  readonly denumire: string;
}

interface ObiectEditabil {
  readonly id: string;
  readonly denumire: string;
  readonly numar_inventar: string;
  readonly serie: string | null;
  readonly model: string | null;
  readonly producator: string | null;
  readonly category_id: string | null;
  readonly data_achizitie: string | null;
  readonly valoare: number | null;
  readonly garantie_expira: string | null;
  readonly stare: string;
  readonly locatie: string | null;
  readonly observatii: string | null;
}

interface Proprietati {
  readonly obiect: ObiectEditabil;
  readonly categorii: readonly OptiuneCategorie[];
  /** Fals dacă obiectul e deja casat sau are o predare deschisă. */
  readonly poateCasa: boolean;
}

interface ValoriEditare {
  denumire: string;
  numar_inventar: string;
  serie: string;
  model: string;
  producator: string;
  category_id: string;
  data_achizitie: string;
  valoare: string;
  garantie_expira: string;
  stare: string;
  locatie: string;
  observatii: string;
}

function laText(valoare: string | null): string {
  return valoare ?? "";
}

/**
 * Editarea și casarea unui obiect de inventar.
 *
 * ── DE CE RĂMÂNE PE react-hook-form ───────────────────────────────────────
 * Fișierul e unul dintre cele care folosesc `useForm`, iar cele două
 * arhitecturi de formular NU se unifică: `<Camp>` e render-prop tocmai ca să
 * meargă peste amândouă. Aici s-a schimbat numai MARCAJUL — `register()` se
 * împrăștie DUPĂ atributele lui `Camp`, ca `ref`-ul să ajungă la element.
 *
 * `useForm` cu `handleSubmit` trimite prin `onSubmit`, nu prin `<form
 * action={fn}>`, deci React 19 nu resetează câmpurile după acțiune și nu se
 * pierde nimic din ce s-a scris. Problema care se repară aici e cealaltă:
 * `create-action.ts` construia `fieldErrors` pentru `actualizeazaObiectSchema`
 * — inclusiv „Garanția nu poate expira înainte de data achiziției.”, care are
 * `path: ["garantie_expira"]` — iar componenta citea doar `error.message` și
 * scria sub buton „Datele introduse nu sunt valide.”. Mesajul exact exista și
 * se arunca.
 *
 * Erorile de server rămân pe câmp până la următoarea trimitere; serverul le
 * suprascrie pe cele de client, fiindcă el a văzut datele întregi și baza.
 *
 * ── DE CE MESAJ LA `required` ─────────────────────────────────────────────
 * `required: true`, fără text, oprea trimiterea și nu spunea NIMIC: formularul
 * are `noValidate`, deci nici bula browserului nu apărea. Mesajele de mai jos
 * sunt copiate cuvânt cu cuvânt din `campuriObiect`, ca omul să citească
 * același lucru indiferent care dintre cele două validări l-a oprit.
 */
export function ActiuniObiect({ obiect, categorii, poateCasa }: Proprietati) {
  const router = useRouter();
  const [modEditare, setModEditare] = useState(false);
  const [confirmaCasare, setConfirmaCasare] = useState(false);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [eroriServer, setEroriServer] = useState<Readonly<Record<string, readonly string[]>>>({});
  const idFormular = useId();
  const idc = (sufix: string): string => `${idFormular}-${sufix}`;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ValoriEditare>({
    defaultValues: {
      denumire: obiect.denumire,
      numar_inventar: obiect.numar_inventar,
      serie: laText(obiect.serie),
      model: laText(obiect.model),
      producator: laText(obiect.producator),
      category_id: obiect.category_id ?? "",
      data_achizitie: laText(obiect.data_achizitie),
      valoare: obiect.valoare === null ? "" : String(obiect.valoare),
      garantie_expira: laText(obiect.garantie_expira),
      stare: obiect.stare,
      locatie: laText(obiect.locatie),
      observatii: laText(obiect.observatii),
    },
  });

  /** Serverul bate clientul: el a văzut datele întregi și baza, clientul un câmp. */
  function eroriCamp(cheie: keyof ValoriEditare): readonly string[] {
    const dinServer = eroriServer[cheie];
    if (dinServer !== undefined) return dinServer;
    const dinClient = errors[cheie]?.message;
    return dinClient === undefined || dinClient === "" ? [] : [dinClient];
  }

  function salveaza(valori: ValoriEditare): void {
    setEroare(null);
    setEroriServer({});
    porneste(async () => {
      const rezultat = await actualizeazaObiect({ id: obiect.id, ...valori });
      if (!rezultat.ok) {
        const peCamp = rezultat.error.fieldErrors ?? {};
        setEroriServer(peCamp);
        // Mesajul general apare DOAR dacă nu e deja pe un câmp. Altfel omul
        // citește aceeași propoziție de două ori, o dată lângă câmp și o dată
        // deasupra butoanelor.
        setEroare(Object.keys(peCamp).length === 0 ? rezultat.error.message : null);
        return;
      }
      setModEditare(false);
      router.refresh();
    });
  }

  function caseaza(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await caseazaObiect({ id: obiect.id });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        setConfirmaCasare(false);
        return;
      }
      setConfirmaCasare(false);
      router.refresh();
    });
  }

  if (modEditare) {
    return (
      <form onSubmit={handleSubmit(salveaza)} className="space-y-4" noValidate>
        {eroare === null ? null : <Callout fel="eroare">{eroare}</Callout>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Camp
            nume="denumire"
            id={idc("denumire")}
            eticheta="Denumire"
            obligatoriu
            erori={eroriCamp("denumire")}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                {...register("denumire", { required: "Câmpul „Denumire” este obligatoriu." })}
              />
            )}
          </Camp>

          <Camp
            nume="numar_inventar"
            id={idc("numar_inventar")}
            eticheta="Număr de inventar"
            obligatoriu
            erori={eroriCamp("numar_inventar")}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                {...register("numar_inventar", {
                  required: "Câmpul „Număr de inventar” este obligatoriu.",
                })}
              />
            )}
          </Camp>

          <Camp nume="serie" id={idc("serie")} eticheta="Serie" erori={eroriCamp("serie")}>
            {(a) => <input {...a} type="text" {...register("serie")} />}
          </Camp>

          <Camp nume="model" id={idc("model")} eticheta="Model" erori={eroriCamp("model")}>
            {(a) => <input {...a} type="text" {...register("model")} />}
          </Camp>

          <Camp
            nume="producator"
            id={idc("producator")}
            eticheta="Producător"
            erori={eroriCamp("producator")}
          >
            {(a) => <input {...a} type="text" {...register("producator")} />}
          </Camp>

          <Camp
            nume="category_id"
            id={idc("category_id")}
            eticheta="Categorie"
            fel="select"
            erori={eroriCamp("category_id")}
          >
            {(a) => (
              <select {...a} {...register("category_id")}>
                <option value="">Necategorizat</option>
                {categorii.map((optiune) => (
                  <option key={optiune.id} value={optiune.id}>
                    {optiune.denumire}
                  </option>
                ))}
              </select>
            )}
          </Camp>

          <Camp
            nume="data_achizitie"
            id={idc("data_achizitie")}
            eticheta="Data achiziției"
            erori={eroriCamp("data_achizitie")}
          >
            {(a) => <input {...a} type="date" {...register("data_achizitie")} />}
          </Camp>

          <Camp
            nume="valoare"
            id={idc("valoare")}
            eticheta="Valoare (lei)"
            erori={eroriCamp("valoare")}
          >
            {(a) => <input {...a} type="number" step="0.01" min="0" {...register("valoare")} />}
          </Camp>

          <Camp
            nume="garantie_expira"
            id={idc("garantie_expira")}
            eticheta="Garanția expiră la"
            erori={eroriCamp("garantie_expira")}
          >
            {(a) => <input {...a} type="date" {...register("garantie_expira")} />}
          </Camp>

          <Camp
            nume="stare"
            id={idc("stare")}
            eticheta="Stare fizică"
            fel="select"
            erori={eroriCamp("stare")}
          >
            {(a) => (
              <select {...a} {...register("stare")}>
                {STARI_OBIECT.map((valoare) => (
                  <option key={valoare} value={valoare}>
                    {ETICHETE_STARE[valoare]}
                  </option>
                ))}
              </select>
            )}
          </Camp>

          <Camp nume="locatie" id={idc("locatie")} eticheta="Locație" erori={eroriCamp("locatie")}>
            {(a) => <input {...a} type="text" {...register("locatie")} />}
          </Camp>
        </div>

        <Camp
          nume="observatii"
          id={idc("observatii")}
          eticheta="Observații"
          fel="textarea"
          erori={eroriCamp("observatii")}
        >
          {(a) => <textarea {...a} rows={3} {...register("observatii")} />}
        </Camp>

        <div className="flex gap-3">
          <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
            Salvează modificările
          </Buton>
          <Buton
            varianta="secundar"
            onClick={() => {
              setModEditare(false);
            }}
            disabled={inCurs}
          >
            Renunță
          </Buton>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      {eroare === null ? null : <Callout fel="eroare">{eroare}</Callout>}

      <div className="flex flex-wrap gap-3">
        <Buton
          varianta="secundar"
          onClick={() => {
            setModEditare(true);
          }}
        >
          Editează datele obiectului
        </Buton>
        {poateCasa && !confirmaCasare ? (
          <Buton
            varianta="distructiv"
            onClick={() => {
              setConfirmaCasare(true);
            }}
          >
            Casează obiectul
          </Buton>
        ) : null}
      </div>

      {confirmaCasare ? (
        <div className="border-danger bg-danger/8 rounded-control border p-4">
          <p className="text-danger text-corp">
            Obiectul trece definitiv în starea „Casat” și nu mai poate fi predat unui angajat.
            Rămâne în evidența organizației permanent — istoricul de predări-primiri nu se poate
            șterge.
          </p>
          <div className="mt-3 flex gap-3">
            <Buton varianta="distructiv" onClick={caseaza} inCurs={inCurs} textInCurs="Se casează…">
              Confirmă casarea
            </Buton>
            <Buton
              varianta="secundar"
              onClick={() => {
                setConfirmaCasare(false);
              }}
              disabled={inCurs}
            >
              Renunță
            </Buton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
