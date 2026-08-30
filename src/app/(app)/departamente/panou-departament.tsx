// src/app/(app)/departamente/panou-departament.tsx
"use client";

import { useCallback, useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRightLeft, Search, UserPlus, Users } from "lucide-react";

import { AvatarAngajat } from "@/components/data/avatar-angajat";
import { Badge } from "@/components/ui/badge";
import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Combobox } from "@/components/ui/combobox";
import { PanouLateral } from "@/components/ui/dialog";
import { StareGoala } from "@/components/ui/stare-goala";
import { cheieCautare } from "@/lib/text/diacritice";
import { clasaBifa } from "@/components/ui/camp";

import { mutaAngajati } from "./actions";

/**
 * Panoul de lucru cu persoanele unui departament.
 *
 * ── DE CE PANOU ȘI NU O SECȚIUNE ÎN PAGINĂ ────────────────────────────────
 * Lista de angajați e partea care crește necontrolat: la un departament de 40
 * de oameni ar împinge restul structurii afară din prima privire, iar la o
 * organizație cu douăzeci de departamente ecranul ar deveni nenavigabil. În
 * panou, lista are derulare proprie și nu mișcă nimic din spatele ei.
 *
 * `PanouLateral`, nu `Dialog`: conținutul e lung. Pe telefon panoul e deja
 * `w-full h-dvh`, deci ecran plin, fără cod în plus.
 *
 * ── `departament === null` E O STARE LEGITIMĂ ─────────────────────────────
 * Atunci panoul arată NEREPARTIZAȚII — oamenii cu `department_id is null`.
 * Erau invizibili pe ecranul ăsta, deși tot ei sunt cei pe care
 * `dezactiveazaDepartament` îți cere să-i muți înainte de a închide un
 * departament.
 */

export interface PersoanaPanou {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
  readonly avatar_url: string | null;
  readonly functie: string | null;
  /** `candidat` | `activ` | `suspendat` | `preaviz` | `incetat` | `arhivat`. */
  readonly status: string;
  readonly esteActiv: boolean;
  /** Denumirea departamentului curent, pentru lista de candidați. */
  readonly departamentCurent: string | null;
}

export interface OptiuneDepartamentPanou {
  readonly id: string;
  readonly denumire: string;
  readonly cod: string;
  readonly activ: boolean;
}

export type PropsPanouDepartament = Readonly<{
  deschis: boolean;
  laInchidere: () => void;
  /** `null` = panoul nerepartizaților. */
  departament: OptiuneDepartamentPanou | null;
  persoane: readonly PersoanaPanou[];
  /** Cine poate fi adus aici: toți ceilalți angajați activi. */
  candidati: readonly PersoanaPanou[];
  departamente: readonly OptiuneDepartamentPanou[];
  poateMuta: boolean;
}>;

const FARA_DEPARTAMENT = "__fara__";

export function PanouDepartament({
  deschis,
  laInchidere,
  departament,
  persoane,
  candidati,
  departamente,
  poateMuta,
}: PropsPanouDepartament) {
  const router = useRouter();
  const [cautare, setCautare] = useState("");
  const [selectate, setSelectate] = useState<ReadonlySet<string>>(new Set());
  const [tinta, setTinta] = useState("");
  const [deAdaugat, setDeAdaugat] = useState("");
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();
  const idCautare = useId();
  const idTinta = useId();
  const idAdauga = useId();

  const filtrate = useMemo(() => {
    const cuvinte = cheieCautare(cautare).split(/\s+/u).filter(Boolean);
    if (cuvinte.length === 0) return persoane;
    return persoane.filter((p) => {
      const caut = cheieCautare(`${p.full_name} ${p.marca} ${p.functie ?? ""}`);
      return cuvinte.every((c) => caut.includes(c));
    });
  }, [persoane, cautare]);

  const inchide = useCallback((): void => {
    setCautare("");
    setSelectate(new Set());
    setTinta("");
    setDeAdaugat("");
    setEroare(null);
    laInchidere();
  }, [laInchidere]);

  function comuta(id: string): void {
    setSelectate((precedent) => {
      const urmator = new Set(precedent);
      if (urmator.has(id)) urmator.delete(id);
      else urmator.add(id);
      return urmator;
    });
  }

  /**
   * O singură acțiune pentru toate cele trei gesturi — mutare, repartizare,
   * scoatere. `department_id: null` nu e un caz special, e o valoare.
   */
  function trimite(idUri: readonly string[], departmentId: string | null): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await mutaAngajati({ employee_ids: idUri, department_id: departmentId });
      // Reîmprospătarea se face pe AMÂNDOUĂ căile, iar asta nu e prudență
      // generică. La un refuz PARȚIAL, rândurile acceptate s-au scris deja, dar
      // acțiunea aruncă — iar `revalidate:` declarat rulează doar pe calea de
      // succes. Fără `router.refresh()` aici, ecranul ar rămâne cu datele vechi
      // și, cum selecția nu s-ar goli, următoarea apăsare ar retrimite exact
      // aceiași identificatori și ar da aceeași eroare la nesfârșit.
      setSelectate(new Set());
      setTinta("");
      setDeAdaugat("");
      router.refresh();
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
      }
    });
  }

  const optiuniTinta = [
    ...(departament === null
      ? []
      : [{ valoare: FARA_DEPARTAMENT, eticheta: "— fără departament —" }]),
    // Departamentele dezactivate nu se oferă deloc: acțiunea le refuză oricum,
    // iar o opțiune care duce garantat la o eroare e mai rea decât absența ei.
    ...departamente
      .filter((d) => d.id !== departament?.id && d.activ)
      .map((d) => ({ valoare: d.id, eticheta: d.denumire, secundar: d.cod })),
  ];

  // Nerepartizații primii: sunt cazul obișnuit, iar dedesubt urmează cei care
  // s-ar muta DIN alt departament — cu departamentul curent scris, ca alegerea
  // să fie informată, nu o surpriză.
  const optiuniCandidati = [...candidati]
    .sort((a, b) => {
      const fara = Number(b.departamentCurent === null) - Number(a.departamentCurent === null);
      return fara !== 0 ? fara : a.full_name.localeCompare(b.full_name, "ro");
    })
    .map((c) => ({
      valoare: c.id,
      eticheta: c.full_name,
      secundar:
        c.departamentCurent === null
          ? `${c.marca} · nerepartizat`
          : `${c.marca} · ${c.departamentCurent}`,
    }));

  /*
   * Se recunoaște după `cod`, nu după `denumire`: denumirea se poate schimba
   * dintr-un ecran, codul e cheia pe care o caută și triggerele din
   * `0107_departamentul_conducere.sql`. O firmă care își redenumește
   * departamentul în „Board” păstrează nota; una care îi schimbă codul o pierde
   * — și tot atunci pierde și repartizarea automată, deci cele două rămân
   * consecvente între ele.
   */
  const esteConducerea = departament !== null && departament.cod.toLowerCase() === "conducere";

  const titlu = departament === null ? "Persoane nerepartizate" : departament.denumire;
  const descriere =
    departament === null
      ? "Angajați activi care nu au niciun departament alocat."
      : `${departament.cod} · ${String(persoane.length)} ${persoane.length === 1 ? "persoană" : "persoane"}`;

  return (
    <PanouLateral deschis={deschis} laInchidere={inchide} titlu={titlu} descriere={descriere}>
      <div className="space-y-4">
        {/*
         * Mecanismul e corect și fără nota asta, dar invizibil: nimic din
         * ecranul de departamente nu spune că un cofondator se adaugă
         * INVITÂNDU-L, nu mutându-l. Câmpul de mai jos mută doar oameni care au
         * deja fișă, deci pe cineva din afara firmei nu-l poate aduce.
         */}
        {esteConducerea ? (
          <Callout
            fel="informativ"
            titlu="Conducerea firmei"
            actiune={
              <Link href="/setari/membri" className="text-nota font-medium underline">
                Invită un cofondator
              </Link>
            }
          >
            Administratorii intră aici automat: invită pe cineva cu rolul „Administrator” și apare
            singur în listă. Poți aduce aici, cu câmpul de mai jos, și asociați sau directori care
            nu au cont în aplicație.
          </Callout>
        ) : null}

        {/*
         * Nota nu e decorativă și nu se poate scoate: scope-ul „team" se rezolvă
         * peste tot pe `manager_path`, niciodată pe `department_id`. Cele două
         * câmpuri stau alături în fișă și n-au nicio legătură între ele. Fără ea,
         * omul care mută pe cineva crede că a mutat și drepturile de aprobare.
         */}
        {poateMuta ? (
          <Callout fel="informativ">
            Mutarea între departamente nu schimbă cine vede pe cine. Drepturile de vizibilitate și
            de aprobare vin din managerul direct al fișei, nu din departament.
          </Callout>
        ) : null}

        {persoane.length > 0 ? (
          <div>
            <label htmlFor={idCautare} className="text-nota font-medium">
              Caută în listă
            </label>
            <div className="relative mt-1">
              <Search
                aria-hidden="true"
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              />
              <input
                id={idCautare}
                type="search"
                value={cautare}
                onChange={(e) => {
                  setCautare(e.target.value);
                }}
                placeholder="Nume, marcă sau funcție"
                className="border-foreground/60 rounded-control text-corp h-9 w-full border py-1.5 pr-3 pl-8 pointer-coarse:h-11"
              />
            </div>
          </div>
        ) : null}

        {filtrate.length === 0 ? (
          <StareGoala
            compact
            fel={cautare === "" ? "initiala" : "filtrata"}
            pictograma={Users}
            titlu={cautare === "" ? "Niciun angajat aici" : "Niciun rezultat"}
            descriere={
              cautare === ""
                ? departament === null
                  ? "Toți angajații activi au un departament alocat."
                  : "Repartizați pe cineva folosind câmpul de mai jos."
                : "Niciun angajat din acest departament nu se potrivește căutării."
            }
          />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {filtrate.map((p) => {
              const ales = selectate.has(p.id);
              return (
                <li key={p.id}>
                  <div
                    className={`rounded-panou flex items-center gap-2.5 border p-2.5 transition-colors ${
                      ales ? "border-primary bg-primary/5" : "border-border bg-surface"
                    }`}
                  >
                    {poateMuta ? (
                      <input
                        type="checkbox"
                        checked={ales}
                        onChange={() => {
                          comuta(p.id);
                        }}
                        aria-label={`Selectează ${p.full_name}`}
                        className={clasaBifa}
                      />
                    ) : null}
                    <AvatarAngajat url={p.avatar_url} nume={p.full_name} marime="sm" />
                    <span className="min-w-0 flex-1">
                      <Link
                        href={`/angajati/${p.id}`}
                        className="text-corp hover:text-primary block truncate font-medium"
                      >
                        {p.full_name}
                      </Link>
                      <span className="text-muted-foreground text-nota block truncate">
                        <span className="font-mono">{p.marca}</span>
                        {p.functie === null ? "" : ` · ${p.functie}`}
                      </span>
                      {/*
                       * Statusul se arată doar când NU e „activ". Persoanele
                       * astea nu intră în efectivul de pe card, dar trebuie să
                       * poată fi mutate: `dezactiveazaDepartament` le numără, iar
                       * până acum nu apăreau nicăieri în interfață — departamentul
                       * părea gol și refuza totuși închiderea.
                       */}
                      {p.esteActiv ? null : (
                        <span className="mt-0.5 inline-block">
                          <Badge ton="ciorna">{p.status}</Badge>
                        </span>
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {eroare === null ? null : (
          <p role="alert" className="text-danger text-nota">
            {eroare}
          </p>
        )}

        {poateMuta ? (
          <div className="border-border space-y-4 border-t pt-4">
            <div>
              <label htmlFor={idTinta} className="text-nota font-medium">
                Mută persoanele selectate
              </label>
              <div className="mt-1 flex flex-wrap items-end gap-2">
                <Combobox
                  id={idTinta}
                  name="tinta"
                  className="min-w-56 flex-1"
                  optiuni={optiuniTinta}
                  valoare={tinta}
                  laSchimbare={setTinta}
                  placeholder="Alege departamentul"
                  textFaraRezultate="Niciun departament găsit."
                  dezactivat={selectate.size === 0}
                />
                <Buton
                  varianta="primar"
                  inCurs={inCurs}
                  textInCurs="Se mută…"
                  disabled={selectate.size === 0 || tinta === ""}
                  onClick={() => {
                    trimite([...selectate], tinta === FARA_DEPARTAMENT ? null : tinta);
                  }}
                >
                  <ArrowRightLeft aria-hidden="true" className="size-4" />
                  {selectate.size === 0
                    ? "Mută"
                    : `Mută ${String(selectate.size)} ${selectate.size === 1 ? "persoană" : "persoane"}`}
                </Buton>
              </div>
            </div>

            {departament === null ? null : (
              <div>
                <label htmlFor={idAdauga} className="text-nota font-medium">
                  Adaugă o persoană în departament
                </label>
                <div className="mt-1 flex flex-wrap items-end gap-2">
                  <Combobox
                    id={idAdauga}
                    name="deAdaugat"
                    className="min-w-56 flex-1"
                    optiuni={optiuniCandidati}
                    valoare={deAdaugat}
                    laSchimbare={setDeAdaugat}
                    placeholder="Caută după nume sau marcă"
                    textFaraRezultate="Niciun angajat disponibil."
                  />
                  <Buton
                    varianta="secundar"
                    inCurs={inCurs}
                    textInCurs="Se adaugă…"
                    disabled={deAdaugat === ""}
                    onClick={() => {
                      trimite([deAdaugat], departament.id);
                    }}
                  >
                    <UserPlus aria-hidden="true" className="size-4" />
                    Repartizează
                  </Buton>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </PanouLateral>
  );
}
