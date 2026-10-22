"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition, type ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { Buton, buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Camp } from "@/components/ui/camp";
import { IncarcareFisier } from "@/components/ui/incarcare-fisier";
import { Schelet } from "@/components/ui/schelet";
import { StareEroare } from "@/components/ui/stare-eroare";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { mascheaza } from "@/domain/fleet/carduri/card";
import {
  CAMPURI_EXTRAS,
  ETICHETE_CAMP_EXTRAS,
  type CampExtras,
} from "@/domain/fleet/carduri/coloane";
import { FORMATE_DATA } from "@/domain/fleet/carduri/date";
import { EMITENTI_CARD, ETICHETE_EMITENT, type EmitentCard } from "@/domain/fleet/carduri/emitenti";
import {
  LIMITA_EXTRAS_BYTES,
  MIME_PENTRU_EXTENSIE,
  extensieExtras,
  verificaFisierExtras,
} from "@/domain/fleet/carduri/limite";
import type { StarePotrivire } from "@/domain/fleet/carduri/potrivire";
import { urcaPeUrlSemnat } from "@/lib/storage/urca-semnat";

import { ETICHETE_STARE_POTRIVIRE, ORDINE_STARI, TON_STARE_POTRIVIRE } from "../etichete";
import {
  analizeazaExtras,
  aplicaImportExtras,
  pregatesteIncarcareaExtrasului,
  salveazaProfilImport,
  type CerereMapare,
  type Previzualizare,
  type RandPrevizualizare,
} from "./actions";

type Profil = Previzualizare["profil"];
type Pas = "incarcare" | "analiza" | "mapare" | "previzualizare" | "aplicare" | "gata";

const MB = Math.round(LIMITA_EXTRAS_BYTES / 1024 / 1024);
const DATA_ORA = new Intl.DateTimeFormat("ro-RO", {
  timeZone: "Europe/Bucharest",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const DATA = new Intl.DateTimeFormat("ro-RO", {
  timeZone: "Europe/Bucharest",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const NUMAR = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 });

const ETICHETE_FORMAT_DATA: Readonly<Record<(typeof FORMATE_DATA)[number], string>> = {
  auto: "Recunoaște singur",
  "zz.ll.aaaa": "zi.lună.an (31.10.2026)",
  "aaaa-ll-zz": "an-lună-zi (2026-10-31)",
  "zz/ll/aaaa": "zi/lună/an (31/10/2026)",
  "ll/zz/aaaa": "lună/zi/an (10/31/2026)",
};

/**
 * Pașii importului de extras (0214, F12b): încărcare → (mapare) →
 * previzualizare → aplicare. Fișierul rămâne în memorie: sursa se șterge din
 * Storage la prima analiză, deci fiecare re-analiză (după mapare) îl urcă din
 * nou, cu alt `batchId`. Nimic nu se scrie în bază până la „Importă”.
 */
export function ImportExtrasClient(): ReactElement {
  const idFisier = useId();
  const idEmitent = useId();
  const idSalveaza = useId();
  const [inCurs, porneste] = useTransition();
  const [pas, setPas] = useState<Pas>("incarcare");
  const [fisier, setFisier] = useState<File | null>(null);
  const [emitent, setEmitent] = useState<EmitentCard | "">("");
  const [eroare, setEroare] = useState<string | null>(null);
  const [cerere, setCerere] = useState<CerereMapare | null>(null);
  const [previzualizare, setPrevizualizare] = useState<Previzualizare | null>(null);
  const [progres, setProgres] = useState({
    procesate: 0,
    importate: 0,
    duplicate: 0,
    total: 0,
  });

  /** Urcarea + analiza, cu profilul ales (sau `null`: cel salvat / recunoașterea automată). */
  function analizeaza(profil: Profil | null): void {
    if (fisier === null || emitent === "") {
      setEroare("Alegeți emitentul și fișierul extrasului.");
      return;
    }
    const problema = verificaFisierExtras(fisier.name, fisier.size);
    const extensie = extensieExtras(fisier.name);
    if (problema !== null || extensie === null) {
      setEroare(problema ?? "Acceptăm extrase .csv sau .xlsx.");
      return;
    }
    setEroare(null);
    setPas("analiza");
    porneste(async () => {
      const pregatire = await pregatesteIncarcareaExtrasului({
        numeFisier: fisier.name,
        dimensiune: fisier.size,
      });
      if (!pregatire.ok) {
        setEroare(pregatire.error.message);
        setPas("incarcare");
        return;
      }
      // Tipul DECLARAT de browser e ce ajunge în Storage; pe Windows cu Excel, un
      // `.csv` vine ca `application/vnd.ms-excel`, absent din lista bucket-ului.
      const reambalat = new File([fisier], fisier.name, {
        type: MIME_PENTRU_EXTENSIE[extensie],
      });
      if (!(await urcaPeUrlSemnat(pregatire.data.urlSemnat, reambalat))) {
        setEroare("Încărcarea fișierului a eșuat. Verificați conexiunea și încercați din nou.");
        setPas("incarcare");
        return;
      }
      const analiza = await analizeazaExtras({
        batchId: pregatire.data.batchId,
        cale: pregatire.data.cale,
        emitent,
        profil,
      });
      if (!analiza.ok) {
        setEroare(analiza.error.message);
        setPas(cerere === null ? "incarcare" : "mapare");
        return;
      }
      if (analiza.data.cereMapare) {
        setCerere(analiza.data);
        setPas("mapare");
        return;
      }
      setPrevizualizare(analiza.data);
      setPas("previzualizare");
    });
  }

  function trimiteMaparea(date: FormData): void {
    if (cerere === null || emitent === "") return;
    const mapare: Partial<Record<CampExtras, string>> = {};
    for (const camp of CAMPURI_EXTRAS) {
      const coloana = String(date.get(`camp_${camp}`) ?? "");
      if (coloana !== "") mapare[camp] = coloana;
    }
    const profil: Profil = {
      mapare,
      format_data: (String(date.get("format_data") ?? "auto") || "auto") as Profil["format_data"],
      separator_zecimal: (String(date.get("separator_zecimal") ?? "auto") ||
        "auto") as Profil["separator_zecimal"],
      delimitator: (String(date.get("delimitator") ?? "auto") || "auto") as Profil["delimitator"],
      codificare: (String(date.get("codificare") ?? "auto") || "auto") as Profil["codificare"],
      rand_antet: Math.min(30, Math.max(1, Number(date.get("rand_antet") ?? 1) || 1)),
    };
    const salveaza = date.get("salveaza") === "da";
    porneste(async () => {
      if (salveaza) {
        const salvare = await salveazaProfilImport({ emitent, profil });
        if (!salvare.ok) {
          setEroare(salvare.error.message);
          return;
        }
      }
      analizeaza(profil);
    });
  }

  function aplica(): void {
    if (previzualizare === null) return;
    setPas("aplicare");
    setEroare(null);
    porneste(async () => {
      let offset = 0;
      let importate = 0;
      let duplicate = 0;
      for (;;) {
        const r = await aplicaImportExtras({
          batchId: previzualizare.batchId,
          offset,
        });
        if (!r.ok) {
          setEroare(`${r.error.message} Puteți relua importul de la rândul ${String(offset + 1)}.`);
          setPas("previzualizare");
          return;
        }
        importate += r.data.importate;
        duplicate += r.data.duplicate;
        offset = r.data.urmator;
        setProgres({
          procesate: offset,
          importate,
          duplicate,
          total: r.data.total,
        });
        if (r.data.gata) break;
      }
      setPas("gata");
    });
  }

  const coloane: readonly Coloana<RandPrevizualizare>[] = [
    {
      cheie: "rand",
      antet: "Rând",
      numeric: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (r) => r.rand,
    },
    {
      cheie: "moment",
      antet: "Data",
      peTelefon: "titlu",
      celula: (r) =>
        r.areOra ? DATA_ORA.format(new Date(r.efectuatLa)) : DATA.format(new Date(r.efectuatLa)),
    },
    {
      cheie: "card",
      antet: "Card / nr. auto",
      peTelefon: "meta",
      celula: (r) => (r.card === null ? (r.nrInmatriculare ?? "—") : mascheaza(r.card)),
    },
    {
      cheie: "produs",
      antet: "Produs",
      peTelefon: "meta",
      celula: (r) => r.produs,
    },
    {
      cheie: "valoare",
      antet: "Cantitate / valoare",
      numeric: true,
      peTelefon: "meta",
      celula: (r) =>
        `${r.cantitate === null ? "" : `${NUMAR.format(r.cantitate)} L · `}${NUMAR.format(r.valoareBruta)} ${r.moneda === "RON" ? "lei" : r.moneda}`,
    },
    {
      cheie: "stare",
      antet: "Potrivire",
      peTelefon: "insigna",
      celula: (r) =>
        r.duplicat ? (
          <Badge ton="neutru">Importată deja</Badge>
        ) : (
          <>
            <Badge ton={TON_STARE_POTRIVIRE[r.stare]}>{ETICHETE_STARE_POTRIVIRE[r.stare]}</Badge>
            {r.motiv === null ? null : (
              <span className="text-muted-foreground text-nota block">{r.motiv}</span>
            )}
          </>
        ),
    },
  ];

  if (pas === "analiza") return <Schelet forma="tabel" randuri={6} coloane={4} />;

  return (
    <section className="flex flex-col gap-6">
      {eroare !== null && (
        <StareEroare
          titlu="Importul nu a putut continua"
          eroare={new Error(eroare)}
          reincearca={() => {
            setEroare(null);
          }}
        />
      )}

      {pas === "incarcare" && (
        <div className="border-border rounded-panou flex flex-col gap-4 border p-6">
          <div className="flex flex-col gap-1">
            <label htmlFor={idEmitent} className="text-corp font-medium">
              Emitentul cardurilor
            </label>
            <select
              id={idEmitent}
              className="border-border h-9 rounded-md border px-2"
              value={emitent}
              onChange={(e) => {
                setEmitent(e.target.value as EmitentCard | "");
              }}
            >
              <option value="" disabled>
                Alegeți emitentul
              </option>
              {EMITENTI_CARD.map((e) => (
                <option key={e} value={e}>
                  {ETICHETE_EMITENT[e]}
                </option>
              ))}
            </select>
          </div>
          <IncarcareFisier
            nume="fisier_extras"
            id={idFisier}
            eticheta="Extrasul de tranzacții"
            accept=".csv,.xlsx"
            maxOcteti={LIMITA_EXTRAS_BYTES}
            mesajPreaMare={`Fișierul depășește ${String(MB)} MB. Împărțiți extrasul pe perioade mai scurte.`}
            mesajTipRespins="Acceptăm extrase .csv sau .xlsx."
            restrictii={`CSV sau Excel .xlsx, cel mult ${String(MB)} MB, cel mult 1000 de tranzacții și 93 de zile. Numerele întregi de card din fișier nu se păstrează.`}
            textAlegere="Alegeți fișierul"
            etichetaScoate="Scoate fișierul ales"
            laSchimbare={setFisier}
          />
          <Buton
            varianta="primar"
            className="self-start"
            disabled={inCurs}
            onClick={() => {
              analizeaza(null);
            }}
          >
            Încarcă și previzualizează
          </Buton>
        </div>
      )}

      {pas === "mapare" && cerere !== null && (
        <form
          className="border-border rounded-panou flex flex-col gap-4 border p-6"
          onSubmit={(e) => {
            e.preventDefault();
            trimiteMaparea(new FormData(e.currentTarget));
          }}
        >
          <Callout fel="atentie" titlu="Alegeți coloanele extrasului">
            <p>{cerere.motiv}</p>
          </Callout>
          <Tabel
            caption={`Primele rânduri din „${cerere.numeFoaie}”, cu numerele lungi mascate.`}
            coloane={cerere.antet.map((col, i) => ({
              cheie: `c${String(i)}`,
              antet: col,
              peTelefon: i === 0 ? ("titlu" as const) : ("meta" as const),
              celula: (rand: readonly string[]) => rand[i] ?? "",
            }))}
            randuri={cerere.esantion}
            cheieRand={(rand) => cerere.esantion.indexOf(rand).toString()}
            densitate="compact"
            gol={null}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            {CAMPURI_EXTRAS.map((camp) => (
              <Camp
                key={camp}
                nume={`camp_${camp}`}
                eticheta={ETICHETE_CAMP_EXTRAS[camp]}
                fel="select"
                erori={[]}
              >
                {(a) => (
                  <select {...a} defaultValue={cerere.mapare[camp] ?? ""}>
                    <option value="">— nu există —</option>
                    {cerere.antet.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Camp nume="format_data" eticheta="Formatul datei" fel="select" erori={[]}>
              {(a) => (
                <select {...a} defaultValue={cerere.profil.format_data}>
                  {FORMATE_DATA.map((f) => (
                    <option key={f} value={f}>
                      {ETICHETE_FORMAT_DATA[f]}
                    </option>
                  ))}
                </select>
              )}
            </Camp>
            <Camp nume="separator_zecimal" eticheta="Separatorul zecimal" fel="select" erori={[]}>
              {(a) => (
                <select {...a} defaultValue={cerere.profil.separator_zecimal}>
                  <option value="auto">Recunoaște singur</option>
                  <option value=",">Virgulă (12,50)</option>
                  <option value=".">Punct (12.50)</option>
                </select>
              )}
            </Camp>
            <Camp
              nume="delimitator"
              eticheta="Separatorul coloanelor (CSV)"
              fel="select"
              erori={[]}
            >
              {(a) => (
                <select {...a} defaultValue={cerere.profil.delimitator}>
                  <option value="auto">Recunoaște singur</option>
                  <option value=";">Punct și virgulă</option>
                  <option value=",">Virgulă</option>
                  <option value="tab">Tab</option>
                </select>
              )}
            </Camp>
            <Camp nume="codificare" eticheta="Codificarea (CSV)" fel="select" erori={[]}>
              {(a) => (
                <select {...a} defaultValue={cerere.profil.codificare}>
                  <option value="auto">Recunoaște singur</option>
                  <option value="utf-8">UTF-8</option>
                  <option value="windows-1250">Windows-1250 (ANSI românesc)</option>
                </select>
              )}
            </Camp>
            <Camp
              nume="rand_antet"
              eticheta="Rândul cu antetul"
              ajutor="Dacă deasupra antetului sunt logo sau numele firmei."
              erori={[]}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min={1}
                  max={30}
                  defaultValue={cerere.profil.rand_antet}
                />
              )}
            </Camp>
          </div>
          <label htmlFor={idSalveaza} className="text-corp flex items-center gap-2">
            <input id={idSalveaza} type="checkbox" name="salveaza" value="da" defaultChecked />
            Salvează maparea pentru {emitent === "" ? "acest emitent" : ETICHETE_EMITENT[emitent]}
          </label>
          <div className="flex flex-wrap gap-3">
            <Buton varianta="primar" type="submit" disabled={inCurs}>
              Previzualizează cu maparea aleasă
            </Buton>
            <Buton
              varianta="secundar"
              type="button"
              onClick={() => {
                setCerere(null);
                setPas("incarcare");
              }}
            >
              Alt fișier
            </Buton>
          </div>
        </form>
      )}

      {pas === "previzualizare" && previzualizare !== null && (
        <div className="flex flex-col gap-4">
          {previzualizare.importatDejaLa.length > 0 ? (
            <Callout fel="atentie" titlu="Fișierul a mai fost importat">
              <p>
                Același fișier a fost importat la{" "}
                {previzualizare.importatDejaLa.map((d) => DATA_ORA.format(new Date(d))).join(", ")}.
                Tranzacțiile deja importate nu se dublează.
              </p>
            </Callout>
          ) : null}
          <p aria-live="polite" className="text-corp">
            {String(previzualizare.randuriFisier)} rânduri citite din „{previzualizare.numeFoaie}”,
            perioada {DATA.format(new Date(`${previzualizare.perioadaDeLa}T12:00:00Z`))} –{" "}
            {DATA.format(new Date(`${previzualizare.perioadaPanaLa}T12:00:00Z`))}:{" "}
            {String(previzualizare.deImportat)} de importat, {String(previzualizare.duplicate)} deja
            importate, {String(previzualizare.numarRespinse)} respinse.
          </p>
          <ul className="flex flex-wrap gap-2">
            {ORDINE_STARI.filter((s: StarePotrivire) => (previzualizare.peStare[s] ?? 0) > 0).map(
              (s) => (
                <li key={s}>
                  <Badge ton={TON_STARE_POTRIVIRE[s]}>
                    {ETICHETE_STARE_POTRIVIRE[s]}: {String(previzualizare.peStare[s] ?? 0)}
                  </Badge>
                </li>
              ),
            )}
          </ul>
          <Tabel
            caption="Primele rânduri ale extrasului, cu potrivirea calculată pe foile de acum."
            coloane={coloane}
            randuri={previzualizare.randuri}
            cheieRand={(r) => String(r.rand)}
            densitate="compact"
            gol={null}
          />
          {previzualizare.respinse.length > 0 ? (
            <Callout fel="atentie" titlu="Rânduri care nu se importă">
              <ul className="list-disc pl-5">
                {previzualizare.respinse.map((r) => (
                  <li key={r.rand}>
                    Rândul {String(r.rand)}: {r.mesaj}
                  </li>
                ))}
              </ul>
            </Callout>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Buton
              varianta="primar"
              disabled={inCurs || previzualizare.deImportat === 0}
              onClick={aplica}
            >
              Importă {String(previzualizare.deImportat)} tranzacții
            </Buton>
            <Buton
              varianta="secundar"
              onClick={() => {
                setCerere({
                  cereMapare: true,
                  motiv: "Schimbați maparea, apoi previzualizați din nou.",
                  numeFoaie: previzualizare.numeFoaie,
                  antet: previzualizare.antet,
                  esantion: previzualizare.esantion,
                  mapare: previzualizare.mapare,
                  ambigue: [],
                  lipsa: [],
                  profil: previzualizare.profil,
                });
                setPas("mapare");
              }}
            >
              Schimbă maparea
            </Buton>
          </div>
        </div>
      )}

      {pas === "aplicare" && (
        <p role="status" aria-live="polite" className="text-corp">
          Se importă… {String(progres.procesate)} din {String(progres.total)} rânduri,{" "}
          {String(progres.importate)} scrise.
        </p>
      )}

      {pas === "gata" && (
        <div className="border-success/40 bg-surface rounded-panou border p-4">
          <p
            role="status"
            aria-live="polite"
            className="text-corp flex items-center gap-2 font-medium"
          >
            <CheckCircle2 aria-hidden="true" className="size-4" />
            Import încheiat: {String(progres.importate)} tranzacții scrise,{" "}
            {String(progres.duplicate)} existau deja.
          </p>
          <Link
            href="/flota/carduri/tranzactii"
            className={`${buton({ varianta: "primar" })} mt-3`}
          >
            Vezi tranzacțiile și nepotrivirile
          </Link>
        </div>
      )}
    </section>
  );
}
