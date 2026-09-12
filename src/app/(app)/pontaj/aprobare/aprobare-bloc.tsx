"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, RefreshCw } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { formatOre } from "@/lib/format/ore";
import { ConfirmareActiune } from "@/components/ui/dialog";

import { aprobaPontajBloc, sincronizeazaConcediile } from "../actions";

interface Proprietati {
  readonly periodId: string;
  readonly departmentId: string | null;
  readonly an: number;
  readonly luna: number;
  readonly poateSincroniza: boolean;
  /**
   * Zilele bifate, sau `null` pentru „tot ce e pe ecran".
   *
   * Era lista de ANGAJAȚI, iar asta făcea alegerea tot-sau-nimic pe fiecare om.
   * Unitatea reală a deciziei e ziua: „pe astea patru le aprob, pe a cincea
   * vreau să vorbesc întâi cu el".
   *
   * Distincția `null` vs. listă nu e cosmetică: `null` lasă acțiunea să prindă
   * și o zi pontată între încărcarea ecranului și apăsarea butonului, iar lista
   * o îngheață pe cea de acum. Vezi nota din `aprobaPontajBlocSchema`.
   */
  readonly idZileAlese: readonly string[] | null;
  readonly numarAngajati: number;
  readonly numarZile: number;
  readonly oreTotale: number;
  /**
   * Lista de bifat — angajații cu zilele lor — randată SUB buton, în aceeași
   * casetă.
   *
   * ── DE CE ÎNĂUNTRU, ȘI NU DUPĂ CASETĂ ────────────────────────────────────
   * Stătea dedesubt, despărțită de buton prin linia de sus a blocului de
   * sincronizare — o acțiune care n-are nicio legătură cu lotul. Cele două
   * jumătăți ale aceleiași decizii („cât aprob" și „ce anume") ajungeau astfel
   * de o parte și de alta a altui subiect, iar propoziția de deasupra
   * butonului părea să nu descrie nimic de pe ecran.
   *
   * Vine ca `ReactNode`, nu construită aici: starea bifelor e a lui
   * `SelectieAprobare`, iar butonul trebuie s-o citească deja numărată.
   */
  readonly lista?: ReactNode;
  /**
   * `true` = luna ARE zile neaprobate pe ecran, oricare ar fi bifele.
   *
   * Distinct de `numarZile > 0`, care numără doar ce e BIFAT. Cât timp cele
   * două erau același lucru, debifarea ultimei zile făcea să dispară propoziția
   * și butonul cu totul — omul rămânea cu o listă și fără nicio cale vizibilă
   * de a aproba, fără să i se spună de ce. Acum blocul rămâne, iar butonul
   * dezactivat spune ce lipsește.
   */
  readonly areCeAproba: boolean;
}

/**
 * Aprobarea în bloc a liniilor de pontaj neaprobate ale lunii (opțional
 * restrânsă la un departament), plus — separat — sincronizarea cu concediile
 * aprobate. Ambele acțiuni sunt independente: sincronizarea NU aprobă nimic,
 * doar completează zilele de concediu lipsă din foaie.
 */
export function AprobareBloc({
  periodId,
  departmentId,
  an,
  luna,
  poateSincroniza,
  idZileAlese,
  numarAngajati,
  numarZile,
  oreTotale,
  lista,
  areCeAproba,
}: Proprietati) {
  const router = useRouter();
  const [observatii, setObservatii] = useState("");
  const [inCursAprobare, pornesteAprobare] = useTransition();
  const [inCursSincronizare, pornesteSincronizare] = useTransition();
  const [eroareAprobare, setEroareAprobare] = useState<string | null>(null);
  const [eroareSincronizare, setEroareSincronizare] = useState<string | null>(null);
  const [rezultatSincronizare, setRezultatSincronizare] = useState<string | null>(null);
  const idObservatii = useId();
  /*
   * Aprobarea în bloc n-avea nicio oprire, deși e ireversibilă: după ea, zilele
   * nu se mai pot modifica manual, iar redeschiderea cere altă acțiune și alt
   * rol. Un clic greșit pe „Aprobă în bloc (412 linii)" nu se poate desface
   * rând cu rând.
   */
  const [confirmareDeschisa, setConfirmareDeschisa] = useState(false);

  function aproba(): void {
    setEroareAprobare(null);
    pornesteAprobare(async () => {
      const rezultat = await aprobaPontajBloc({
        period_id: periodId,
        department_id: departmentId,
        // Selecția pleacă pe ZILE. `employee_ids` rămâne `null`: filtrarea pe
        // om e cuprinsă în cea pe zile, iar două site peste aceeași mulțime
        // s-ar putea contrazice la prima schimbare a uneia dintre ele.
        employee_ids: null,
        entry_ids: idZileAlese === null ? null : [...idZileAlese],
        observatii: observatii.trim().length === 0 ? null : observatii.trim(),
      });
      if (!rezultat.ok) {
        setEroareAprobare(rezultat.error.message);
        return;
      }
      setObservatii("");
      router.refresh();
    });
  }

  function sincronizeaza(): void {
    setEroareSincronizare(null);
    setRezultatSincronizare(null);
    pornesteSincronizare(async () => {
      const rezultat = await sincronizeazaConcediile({ an, luna });
      if (!rezultat.ok) {
        setEroareSincronizare(rezultat.error.message);
        return;
      }
      setRezultatSincronizare(
        `${String(rezultat.data.create)} zile noi, ${String(rezultat.data.actualizate)} actualizate, ${String(rezultat.data.pastrate)} păstrate neschimbate.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="border-border rounded-panou space-y-4 border p-4">
      {/*
        Blocul apare DOAR când luna ARE zile neaprobate — nu când sunt bifate.
        Fără condiția asta, ecranul spunea de trei ori același lucru pe o lună
        deja închisă: butonul dezactivat „(0 linii)", un mesaj ROȘU care arăta
        ca o defecțiune, și starea goală. Iar sincronizarea de dedesubt rămâne
        oricum vizibilă — ea e utilă exact când foaia e goală.

        Condiția era `numarZile === 0`, adică numărul BIFAT, ceea ce confunda
        două stări diferite: „nu e nimic de aprobat" și „n-ai ales nimic".
        Debifarea ultimei zile făcea să dispară propoziția și butonul, fără
        nicio explicație.
      */}
      {!areCeAproba ? null : (
        <div className="space-y-2">
          {/*
            CE APROBI, ÎN CUVINTE, DEASUPRA BUTONULUI.

            Butonul scria „Aprobă în bloc (412 linii)" peste o listă pe care
            n-o descria: „linii" nu spune nici câți oameni, nici câte ore, iar
            ca să afli trebuia să te întorci în calendar. Acum propoziția e
            lângă apăsare, se schimbă odată cu bifele, și e aceeași cu cifrele
            din caseta de confirmare.
          */}
          {numarZile === 0 ? (
            <p className="text-muted-foreground text-corp">
              Nicio zi bifată. Alegeți cel puțin una din lista de mai jos.
            </p>
          ) : (
            <p className="text-foreground text-corp">
              Se aprobă <strong className="tabular-nums">{numarZile}</strong>{" "}
              {numarZile === 1 ? "zi" : "zile"} de pontaj, de la{" "}
              <strong className="tabular-nums">{numarAngajati}</strong>{" "}
              {numarAngajati === 1 ? "angajat" : "angajați"}, însumând{" "}
              <strong className="tabular-nums">{formatOre(oreTotale)}</strong> ore
              {departmentId === null ? "" : ", din departamentul filtrat acum"}.
            </p>
          )}
          <label htmlFor={idObservatii} className="text-corp block font-medium">
            Observații lot (opțional)
          </label>
          <textarea
            id={idObservatii}
            rows={2}
            maxLength={1000}
            value={observatii}
            onChange={(e) => {
              setObservatii(e.target.value);
            }}
            className="border-foreground/60 rounded-control text-corp w-full border px-3 py-2"
          />
          <Buton
            varianta="primar"
            onClick={() => {
              setConfirmareDeschisa(true);
            }}
            disabled={numarZile === 0}
            inCurs={inCursAprobare}
            textInCurs="Se aprobă…"
          >
            <CheckCheck aria-hidden="true" className="size-4" />
            {numarZile === 0
              ? "Alegeți cel puțin o zi"
              : `Aprobă ${String(numarZile)} ${numarZile === 1 ? "zi" : "zile"}`}
          </Buton>
          {eroareAprobare === null ? null : (
            <p role="alert" className="text-danger text-corp">
              {eroareAprobare}
            </p>
          )}
        </div>
      )}

      {lista}

      <ConfirmareActiune
        deschis={confirmareDeschisa}
        laInchidere={() => {
          setConfirmareDeschisa(false);
        }}
        titlu="Aprobați lotul de pontaj?"
        consecinta={
          departmentId === null
            ? "Liniile aprobate nu se mai pot modifica manual. Redeschiderea lor cere altă acțiune și alt rol."
            : "Se aprobă numai liniile departamentului filtrat acum. Liniile aprobate nu se mai pot modifica manual."
        }
        cifre={[
          { eticheta: "Perioada", valoare: `${String(luna).padStart(2, "0")}.${String(an)}` },
          { eticheta: "Zile aprobate", valoare: String(numarZile) },
          { eticheta: "Angajați", valoare: String(numarAngajati) },
          { eticheta: "Ore", valoare: formatOre(oreTotale) },
          {
            eticheta: "Cuprindere",
            valoare:
              idZileAlese !== null
                ? "numai zilele bifate"
                : departmentId === null
                  ? "toate departamentele"
                  : "un singur departament",
          },
        ]}
        etichetaConfirmare="Aprobă lotul"
        inCurs={inCursAprobare}
        laConfirmare={() => {
          setConfirmareDeschisa(false);
          aproba();
        }}
      />

      {poateSincroniza ? (
        <div className="border-border space-y-2 border-t pt-4">
          <p className="text-muted-foreground text-corp">
            Completează automat zilele de concediu aprobat lipsă din foaie, fără să atingă vreo zi
            introdusă manual.
          </p>
          <Buton
            varianta="secundar"
            onClick={sincronizeaza}
            inCurs={inCursSincronizare}
            textInCurs="Se sincronizează…"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Sincronizează cu concediile aprobate
          </Buton>
          <div aria-live="polite">
            {eroareSincronizare !== null ? (
              <p role="alert" className="text-danger text-corp">
                {eroareSincronizare}
              </p>
            ) : rezultatSincronizare !== null ? (
              <p className="text-muted-foreground text-corp">{rezultatSincronizare}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
