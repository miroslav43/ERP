"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { arataToast } from "@/components/ui/toast";
import {
  dataInceputNeobisnuita,
  grupeazaUit,
  normalizeazaUit,
  stareUitLaZi,
  VALABILITATE_UIT_IMPLICITA,
  VALABILITATI_UIT,
  verificaUit,
  type ProblemaUit,
} from "@/domain/fleet/uit";

import {
  AJUTOR_DATA_INCEPUT_UIT,
  etichetaStareUit,
  ETICHETE_VALABILITATE_UIT,
  TONURI_STARE_UIT,
} from "../../etichete";
import { actualizeazaUit, adaugaUit, stergeUit } from "../uit/actions";

/**
 * Codurile UIT (RO e-Transport) ale unei curse, pe foaie și în portal (F12f,
 * 0217): lista, cu pastila de stare în ziua foii, și formularele.
 *
 * Fiecare formular are tranziția și erorile lui (`FormularDialog`): un refuz pe
 * UIT nu înroșește alimentarea sau cursa. Codul se normalizează la tastare
 * (O→0, I→1, Z→2, S→5, G→6, B→8), iar omul vede ce s-a citit ÎNAINTE de salvare
 * (decizia I-f3). Formatul și cifrele de control le verifică și schema, și baza.
 */
export type UitAfisat = Readonly<{
  id: string;
  uit: string;
  data_inceput: string;
  valabilitate_zile: number;
  observatii: string | null;
}>;

type Proprietati = Readonly<{
  foaieId: string;
  cursaId: string;
  /** Ziua foii, `AAAA-LL-ZZ`: pastila spune dacă fiecare cod o acoperă. */
  ziuaFoii: string;
  uituri: readonly UitAfisat[];
  /** Ciornă și apelantul o poate scrie. Altfel lista e doar de citit. */
  editabil: boolean;
}>;

export function UitCursa({
  foaieId,
  cursaId,
  ziuaFoii,
  uituri,
  editabil,
}: Proprietati): ReactElement {
  return (
    <div className="space-y-1">
      {uituri.length === 0 ? (
        <p className="text-muted-foreground text-xs">Niciun cod UIT.</p>
      ) : (
        <ul className="space-y-1">
          {uituri.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-xs tracking-wide">{grupeazaUit(u.uit)}</span>
              <Badge ton={TONURI_STARE_UIT[stareUitLaZi(u, ziuaFoii)]}>
                {etichetaStareUit(u, ziuaFoii)}
              </Badge>
              {editabil ? (
                <span className="flex gap-1">
                  <DialogUit foaieId={foaieId} cursaId={cursaId} ziuaFoii={ziuaFoii} uit={u} />
                  <ButonStergeUit foaieId={foaieId} uit={u} />
                </span>
              ) : null}
              {u.observatii === null ? null : (
                <span className="text-muted-foreground block w-full text-xs">{u.observatii}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {editabil ? (
        <DialogUit foaieId={foaieId} cursaId={cursaId} ziuaFoii={ziuaFoii} uit={null} />
      ) : null}
    </div>
  );
}

const MESAJE_PROBLEMA: Readonly<Record<ProblemaUit, string>> = {
  lungime: "are 16 caractere",
  caractere: "conține doar cifre și literele A C D E F H J K L M N P Q R T U V W X Y",
  control: "ultimele două cifre nu se potrivesc",
};

/** Codul tastat, cu ce a citit aplicația din el, înainte de salvare. */
function CampCodUit({
  idCamp,
  erori,
  valoareInitiala,
}: Readonly<{ idCamp: string; erori: readonly string[]; valoareInitiala: string }>): ReactElement {
  const [brut, setBrut] = useState(valoareInitiala);
  const normalizat = normalizeazaUit(brut.trim());
  const verdict = verificaUit(normalizat);
  return (
    <Camp
      nume="uit"
      id={idCamp}
      eticheta="Codul UIT"
      obligatoriu
      ajutor="16 caractere, de pe documentul primit. Spațiile și cratimele nu contează."
      className="sm:col-span-2"
      erori={erori}
    >
      {(a) => (
        <>
          <input
            {...a}
            autoComplete="off"
            spellCheck={false}
            maxLength={40}
            value={brut}
            onChange={(e) => {
              setBrut(e.target.value);
            }}
          />
          {normalizat === "" ? null : (
            <span className="text-muted-foreground mt-1 block text-xs" aria-live="polite">
              Am citit: <span className="font-mono">{grupeazaUit(normalizat)}</span>
              {verdict.ok ? " — format valid." : ` — codul ${MESAJE_PROBLEMA[verdict.problema]}.`}
            </span>
          )}
        </>
      )}
    </Camp>
  );
}

/** Data de început, cu nota nemodală când pare greșită (an greșit, peste fereastră). */
function CampDataInceput({
  idCamp,
  erori,
  valoareInitiala,
  ziuaFoii,
}: Readonly<{
  idCamp: string;
  erori: readonly string[];
  valoareInitiala: string;
  ziuaFoii: string;
}>): ReactElement {
  const [data, setData] = useState(valoareInitiala);
  return (
    <Camp
      nume="data_inceput"
      id={idCamp}
      eticheta="Data începerii transportului"
      obligatoriu
      ajutor={AJUTOR_DATA_INCEPUT_UIT}
      erori={erori}
    >
      {(a) => (
        <>
          <input
            {...a}
            type="date"
            value={data}
            onChange={(e) => {
              setData(e.target.value);
            }}
          />
          {data !== "" && dataInceputNeobisnuita(data, ziuaFoii) ? (
            <span className="text-warning mt-1 block text-xs" aria-live="polite">
              Data e departe de ziua foii. Verificați-o pe documentul transportului.
            </span>
          ) : null}
        </>
      )}
    </Camp>
  );
}

function DialogUit({
  foaieId,
  cursaId,
  ziuaFoii,
  uit,
}: Readonly<{
  foaieId: string;
  cursaId: string;
  ziuaFoii: string;
  /** `null` = cod nou. */
  uit: UitAfisat | null;
}>): ReactElement {
  async function trimite(date: FormData) {
    const comun = {
      trip_sheet_id: foaieId,
      data_inceput: String(date.get("data_inceput") ?? ""),
      // Text, nu `Number()`: golul ajunge la schemă ca gol și revine la 5 zile.
      valabilitate_zile: String(date.get("valabilitate_zile") ?? "").trim(),
      observatii: String(date.get("observatii") ?? ""),
    };
    if (uit !== null) return actualizeazaUit({ ...comun, id: uit.id });
    return adaugaUit({ ...comun, cursa_id: cursaId, uit: String(date.get("uit") ?? "") });
  }

  const valabilitateInitiala = String(uit?.valabilitate_zile ?? VALABILITATE_UIT_IMPLICITA);
  const optiuni: readonly number[] = VALABILITATI_UIT.includes(
    (uit?.valabilitate_zile ?? VALABILITATE_UIT_IMPLICITA) as (typeof VALABILITATI_UIT)[number],
  )
    ? VALABILITATI_UIT
    : [...VALABILITATI_UIT, uit?.valabilitate_zile ?? VALABILITATE_UIT_IMPLICITA];

  return (
    <FormularDialog
      declansator={
        uit === null
          ? {
              eticheta: "Adaugă UIT",
              varianta: "tertiar",
              pictograma: <Plus aria-hidden="true" className="size-4" />,
            }
          : {
              eticheta: <Pencil aria-hidden="true" className="size-4" />,
              varianta: "tertiar",
              marime: "iconita",
              "aria-label": `Modifică codul UIT ${grupeazaUit(uit.uit)}`,
            }
      }
      titlu={uit === null ? "Cod UIT nou" : `Codul UIT ${grupeazaUit(uit.uit)}`}
      descriere={
        uit === null
          ? "Codul primit pentru partida de bunuri de pe această cursă. La grupaj, câte un cod pe partidă."
          : "Se corectează data și valabilitatea. Un cod greșit se șterge și se adaugă din nou."
      }
      actiune={trimite}
      mesajReusita={uit === null ? "Codul UIT a fost adăugat." : "Codul UIT a fost modificat."}
      etichetaTrimite={uit === null ? "Adaugă codul" : "Salvează"}
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          {uit === null ? (
            <CampCodUit
              idCamp={idc("uit")}
              erori={stare.erori["uit"] ?? []}
              valoareInitiala={stare.valoriTrimise["uit"] ?? ""}
            />
          ) : null}
          <CampDataInceput
            idCamp={idc("data_inceput")}
            erori={stare.erori["data_inceput"] ?? []}
            valoareInitiala={stare.valoriTrimise["data_inceput"] ?? uit?.data_inceput ?? ziuaFoii}
            ziuaFoii={ziuaFoii}
          />
          <Camp
            nume="valabilitate_zile"
            id={idc("valabilitate_zile")}
            eticheta="Valabilitatea"
            fel="select"
            erori={stare.erori["valabilitate_zile"] ?? []}
          >
            {(a) => (
              <select
                {...a}
                defaultValue={stare.valoriTrimise["valabilitate_zile"] ?? valabilitateInitiala}
              >
                {optiuni.map((zile) => (
                  <option key={zile} value={String(zile)}>
                    {zile === 5 || zile === 15
                      ? ETICHETE_VALABILITATE_UIT[zile]
                      : `${String(zile)} zile`}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          <Camp
            nume="observatii"
            id={idc("observatii")}
            eticheta="Observații"
            className="sm:col-span-2"
            erori={stare.erori["observatii"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                maxLength={200}
                defaultValue={stare.valoriTrimise["observatii"] ?? uit?.observatii ?? ""}
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}

function ButonStergeUit({
  foaieId,
  uit,
}: Readonly<{ foaieId: string; uit: UitAfisat }>): ReactElement {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deschis, setDeschis] = useState(false);
  const grupat = grupeazaUit(uit.uit);

  function confirma(): void {
    porneste(async () => {
      const rezultat = await stergeUit({ id: uit.id, trip_sheet_id: foaieId });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({ fel: "reusita", text: "Codul UIT a fost șters." });
      router.refresh();
    });
  }

  return (
    <>
      <Buton
        varianta="tertiar"
        marime="iconita"
        aria-label={`Șterge codul UIT ${grupat}`}
        onClick={() => {
          setDeschis(true);
        }}
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </Buton>
      <ConfirmareActiune
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu="Ștergeți codul UIT?"
        consecinta="Codul iese de pe cursă. Dacă a fost o greșeală de tastare, adăugați codul corect: jurnalul le păstrează pe amândouă."
        cifre={[{ eticheta: "Codul", valoare: grupat }]}
        etichetaConfirmare="Șterge codul"
        distructiv
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}
