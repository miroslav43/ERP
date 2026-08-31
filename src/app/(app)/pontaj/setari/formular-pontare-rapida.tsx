"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { Ban, CheckCheck, Clock, Handshake, Layers, Lock, Printer, QrCode } from "lucide-react";

import { AlegereCarduri, type OptiuneCard } from "@/components/ui/alegere-carduri";
import { Buton, buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { IntrareOra } from "@/components/ui/intrare-ora";
import { intervalulPropus, type ConfigZi } from "@/domain/attendance/calcul-ore";
import { cePoateFace, type ConfigPontareRapida } from "@/domain/attendance/pontare-rapida";
import type { AfisPontare } from "@/lib/queries/attendance";
import { formatOre } from "@/lib/format/ore";

import { salveazaPontareaRapida } from "./actions";

const CAMP = "border-foreground/60 rounded-control border px-3 py-2 text-corp";

/**
 * Cum se pontează de pe telefon.
 *
 * ── DE CE ECRANUL ĂSTA ARATĂ CE VA SCRIE BUTONUL ────────────────────────────
 * Aceeași disciplină ca panoul viu din formularul de reguli: nu se cere o
 * alegere fără să se arate consecința ei. Un patron care alege „confirmarea
 * zilei standard" fără să vadă intervalul rezultat n-are cum să prindă o normă
 * pusă greșit.
 *
 * ── DE CE CARDURI ȘI NU DOUĂ `<select>` ─────────────────────────────────────
 * Alegerea RAMIFICĂ restul ecranului, iar fiecare opțiune are nevoie de
 * explicația ei. Într-un `<select>`, explicația se vede DUPĂ alegere, pentru
 * opțiunea deja aleasă — exact pe dos față de ce trebuie. Erau două `<select>`
 * aici, în formularul juridic, și de acolo vine reclamația.
 */
export function FormularPontareRapida({
  pontare,
  afise,
  config,
}: {
  readonly pontare: ConfigPontareRapida;
  readonly afise: readonly AfisPontare[];
  /** Norma și pauza în vigoare azi — hrănesc intervalul propus. */
  readonly config: ConfigZi;
}) {
  const idProgram = useId();
  const [seTrimite, porneste] = useTransition();
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [eroare, setEroare] = useState<string | null>(null);

  const [mod, setMod] = useState<string>(pontare.mod);
  const [verificare, setVerificare] = useState<string>(pontare.verificare);
  const [programStart, setProgramStart] = useState(pontare.programStart ?? "");
  const [necesitaAprobare, setNecesitaAprobare] = useState(pontare.necesitaAprobare);

  const afiseCuCod = afise.filter((a) => a.activ && a.areCod);
  const areAfis = afiseCuCod.length > 0;

  const cereProgram = mod === "confirmare" || mod === "ambele";
  const intervalPropus = programStart === "" ? null : intervalulPropus(programStart, config);

  const posibilitati = cePoateFace(
    {
      mod: mod as ConfigPontareRapida["mod"],
      verificare: verificare as ConfigPontareRapida["verificare"],
    },
    areAfis,
  );

  const MODURI: readonly OptiuneCard[] = [
    {
      valoare: "ceas",
      eticheta: "Ceas: „Am intrat” / „Am ieșit”",
      descriere: "Două atingeri, cu ora reală de la serverul nostru.",
      pictograma: Clock,
    },
    {
      valoare: "confirmare",
      eticheta: "Confirmarea zilei standard",
      descriere: "O atingere. Scrie programul obișnuit, nu ora apăsării.",
      pictograma: CheckCheck,
    },
    { valoare: "ambele", eticheta: "Amândouă", descriere: "Angajatul alege.", pictograma: Layers },
    {
      valoare: "oprit",
      eticheta: "Oprit",
      descriere: "Numai formularul cu ore de intrare și de ieșire.",
      pictograma: Ban,
    },
  ];

  /*
   * `cod_qr` se stinge când nu există afiș, CU motivul scris — uniunea
   * discriminată din `AlegereCarduri` nu compilează altfel. Fără asta, alegerea
   * ar fi salvabilă și ar opri pontarea pentru toată firma, tăcut: acțiunea o
   * refuză oricum pe server, dar un refuz pe care nu-l poți anticipa de pe ecran
   * e tot o atingere aruncată.
   */
  const VERIFICARI: readonly OptiuneCard[] = [
    {
      valoare: "fara",
      eticheta: "Pe încredere",
      descriere: "Angajatul pontează de oriunde, ca la formularul cu ore.",
      pictograma: Handshake,
    },
    {
      valoare: "optional",
      eticheta: "Codul QR e opțional",
      descriere: "Afișul pontează pentru cine îl scanează; butonul rămâne pentru restul.",
      pictograma: QrCode,
    },
    areAfis
      ? {
          valoare: "cod_qr",
          eticheta: "Numai prin cod QR",
          descriere: "Butonul din aplicație dispare. Se pontează exclusiv scanând afișul.",
          pictograma: Lock,
        }
      : {
          valoare: "cod_qr",
          eticheta: "Numai prin cod QR",
          descriere: "Butonul din aplicație dispare. Se pontează exclusiv scanând afișul.",
          pictograma: Lock,
          indisponibil: true,
          motiv:
            "Niciun punct de lucru activ n-are cod de pontare, deci n-ar exista afiș de scanat.",
        },
  ];

  function trimite(): void {
    setMesaj(null);
    setEroare(null);
    porneste(async () => {
      const rezultat = await salveazaPontareaRapida({
        mod_pontare_rapida: mod,
        verificare_pontare: verificare,
        program_start: programStart === "" ? null : programStart,
        necesita_aprobare: necesitaAprobare,
      });
      if (rezultat.ok) setMesaj("Setările au fost salvate.");
      else setEroare(rezultat.error.message);
    });
  }

  return (
    <div className="border-border rounded-panou space-y-6 border p-4">
      <section className="space-y-3">
        <h2 className="text-corp font-medium">Cum se pontează</h2>
        <p className="text-muted-foreground text-nota">
          Cifrele se calculează pe server, din regulile de timp — omul declară doar că a fost la
          muncă. Nici ora, nici numărul de ore nu vin de pe telefon.
        </p>
        <AlegereCarduri
          nume="mod_pontare_rapida"
          eticheta="Cum se pontează"
          optiuni={MODURI}
          valoare={mod}
          laSchimbare={setMod}
          coloane={2}
        />
      </section>

      {cereProgram ? (
        <section className="space-y-2">
          <label htmlFor={idProgram} className="text-corp">
            Ora de început a programului
          </label>
          <IntrareOra
            id={idProgram}
            valoare={programStart}
            onSchimba={setProgramStart}
            className={CAMP}
          />
          <p className="text-muted-foreground text-nota">
            Ora de sfârșit NU se completează: se calculează din normă și din pauză, ca să nu existe
            două cifre care se pot contrazice.
          </p>
          {intervalPropus === null ? (
            <p className="text-warning text-corp">
              {programStart === ""
                ? "Completați ora de început: fără ea, butonul de confirmare nu se poate afișa."
                : "Programul nu încape într-o singură zi calendaristică."}
            </p>
          ) : (
            <p className="text-muted-foreground text-corp">
              Butonul va propune{" "}
              <span className="text-foreground font-medium tabular-nums">
                {intervalPropus.inceput}–{intervalPropus.sfarsit}
              </span>{" "}
              și va înregistra{" "}
              <span className="text-foreground font-medium tabular-nums">
                {formatOre(config.orePeZi)} h
              </span>{" "}
              lucrate.
            </p>
          )}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-corp font-medium">Verificarea prezenței</h2>
        <p className="text-muted-foreground text-nota">
          Codul QR dovedește că cineva a fost lângă afiș, nu că angajatul era acolo. E o frână, nu o
          probă — pontajul rămâne declarația angajatului.
        </p>
        <AlegereCarduri
          nume="verificare_pontare"
          eticheta="Verificarea prezenței"
          optiuni={VERIFICARI}
          valoare={verificare}
          laSchimbare={setVerificare}
          coloane={3}
        />
        {posibilitati.cereScanare ? (
          <Callout fel="atentie" titlu="Butonul din aplicație nu se mai desenează">
            Cu această alegere, un angajat fără afișul la îndemână nu mai poate ponta deloc.
            Asigurați-vă că afișul e tipărit și lipit la fiecare intrare.
          </Callout>
        ) : null}
      </section>

      {/*
        Puntea care lipsea. Ecranul cerea o alegere despre codul QR fără să spună
        dacă firma are vreun punct de lucru, dacă are cod, și fără drum spre
        afiș — care se generează în alt modul.
      */}
      <section className="space-y-2">
        <h2 className="text-corp font-medium">Afișele de pontare</h2>
        {afise.length === 0 ? (
          <p className="text-muted-foreground text-corp">
            Firma n-are niciun punct de lucru.{" "}
            <Link href="/puncte-lucru" className="underline underline-offset-2">
              Adăugați unul
            </Link>{" "}
            ca să puteți tipări un afiș.
          </p>
        ) : (
          <ul className="text-corp divide-border divide-y">
            {afise.map((afis) => (
              <li key={afis.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {afis.denumire}
                  {afis.activ ? null : (
                    <span className="text-muted-foreground text-nota"> (inactiv)</span>
                  )}
                </span>
                {afis.areCod ? (
                  <Link
                    href={`/puncte-lucru/${afis.id}/afis`}
                    className={buton({ varianta: "tertiar" })}
                  >
                    <Printer aria-hidden="true" className="size-3.5" />
                    Tipărește afișul
                  </Link>
                ) : (
                  <Link href="/puncte-lucru" className={buton({ varianta: "tertiar" })}>
                    <QrCode aria-hidden="true" className="size-3.5" />
                    Generează cod
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/*
        ── APROBAREA, CA ALEGERE A FIRMEI (0118) ─────────────────────────────
        Bifă, nu carduri: spre deosebire de „cum se pontează", alegerea asta nu
        ramifică restul ecranului și n-are nevoie de patru explicații deodată.

        Polaritate POZITIVĂ, identică cu numele coloanei — bifat = se cere
        aprobare. O bifă „nu are nevoie de aprobare" ar fi cerut o negație între
        ecran și bază, adică locul clasic unde cineva o repară pe jumătate.

        Textul de dedesubt spune consecința VĂZUTĂ, nu regula: cine debifează
        trebuie să afle că-i dispare o filă din navigare, altfel o caută.
      */}
      <section className="space-y-2">
        <h2 className="text-corp font-medium">Aprobarea pontajului</h2>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={necesitaAprobare}
            onChange={(e) => {
              setNecesitaAprobare(e.target.checked);
            }}
            className="border-foreground/60 rounded-control mt-0.5 size-4 border"
          />
          <span className="text-corp">Pontajul trece printr-un pas de aprobare</span>
        </label>
        <p className="text-muted-foreground text-nota">
          {necesitaAprobare
            ? "Zilele înregistrate așteaptă decizia unui aprobator, iar planurile săptămânale se trimit spre aprobare. Fila „Aprobare” rămâne în navigarea pontajului."
            : "Zilele se salvează direct, pentru toată lumea — inclusiv pentru angajați — și rămân modificabile până la blocarea lunii. Planul săptămânii se închide în clipa trimiterii, iar fila „Aprobare” dispare din navigare."}
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Buton
          varianta="primar"
          onClick={trimite}
          inCurs={seTrimite}
          textInCurs="Se salvează…"
          disabled={cereProgram && intervalPropus === null}
        >
          Salvează
        </Buton>
        {/* Fără dată de intrare în vigoare: setările astea n-au istoric. */}
        <p className="text-muted-foreground text-nota">Se aplică imediat, pentru toată firma.</p>
      </div>

      {mesaj !== null ? <p className="text-success text-corp">{mesaj}</p> : null}
      {eroare !== null ? (
        <p role="alert" className="text-danger text-corp">
          {eroare}
        </p>
      ) : null}
    </div>
  );
}
