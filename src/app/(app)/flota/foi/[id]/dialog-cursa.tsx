"use client";

import { Pencil, Plus } from "lucide-react";
import { useState, type ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { oraRomanieiPentruCamp } from "@/lib/format/date";
import {
  cursaDinSablon,
  type CursaFoaie,
  type PropunereCursa,
  type SablonTraseu,
} from "@/domain/fleet/foaie";

import { actualizeazaCursa, adaugaCursa } from "../../actions-curse";

/**
 * Cursa nouă sau corectura uneia, pe ciorna foii zilnice (0200).
 *
 * Regulile pe care baza le refuză oricum (ziua foii, ordinea, kilometrajul
 * monoton, „doar ultima cursă poate rămâne deschisă”) nu se repetă aici: vin ca
 * P0001 cu mesajul pe câmp, prin `traduEroare`. Caseta doar PROPUNE cifrele
 * acceptate — kilometrajul de la sosirea cursei precedente, locul unde s-a
 * ajuns — ca omul să le vadă înainte de a salva.
 *
 * Șablonul de traseu precompletează locurile, scopul și kilometrajul de
 * sosire estimat. Câmpurile se REMONTEAZĂ la schimbarea șablonului (`key`):
 * sunt necontrolate, iar un `defaultValue` nou nu se aplică altfel.
 */
type Proprietati = Readonly<{
  foaieId: string;
  /** `null` = cursă nouă. */
  cursa: CursaFoaie | null;
  propunere: PropunereCursa;
  sabloane: readonly SablonTraseu[];
}>;

type Implicite = Readonly<{
  plecare_la: string;
  sosire_la: string;
  de_la_loc: string;
  pana_la_loc: string;
  scop: string;
  km_plecare: string;
  km_sosire: string;
}>;

function impliciteCursa(
  cursa: CursaFoaie | null,
  propunere: PropunereCursa,
  sablon: SablonTraseu | null,
): Implicite {
  if (cursa !== null) {
    return {
      plecare_la: oraRomanieiPentruCamp(cursa.plecare_la),
      sosire_la: cursa.sosire_la === null ? "" : oraRomanieiPentruCamp(cursa.sosire_la),
      de_la_loc: cursa.de_la_loc ?? "",
      pana_la_loc: cursa.pana_la_loc ?? "",
      scop: cursa.scop ?? "",
      km_plecare: String(cursa.km_plecare),
      km_sosire: cursa.km_sosire === null ? "" : String(cursa.km_sosire),
    };
  }
  const plecare = propunere.dupa === null ? "" : oraRomanieiPentruCamp(propunere.dupa);
  if (sablon !== null) {
    const dinSablon = cursaDinSablon(sablon, propunere);
    return {
      plecare_la: plecare,
      sosire_la: "",
      de_la_loc: dinSablon.de_la_loc,
      pana_la_loc: dinSablon.pana_la_loc,
      scop: dinSablon.scop,
      km_plecare: String(dinSablon.km_plecare),
      km_sosire: dinSablon.km_sosire === null ? "" : String(dinSablon.km_sosire),
    };
  }
  return {
    plecare_la: plecare,
    sosire_la: "",
    de_la_loc: propunere.deLaLoc ?? "",
    pana_la_loc: "",
    scop: "",
    km_plecare: String(propunere.kmPlecare),
    km_sosire: "",
  };
}

export function DialogCursa({ foaieId, cursa, propunere, sabloane }: Proprietati): ReactElement {
  const [sablonId, setSablonId] = useState("");

  async function trimite(date: FormData) {
    const comun = {
      trip_sheet_id: foaieId,
      plecare_la: String(date.get("plecare_la") ?? ""),
      sosire_la: String(date.get("sosire_la") ?? ""),
      de_la_loc: String(date.get("de_la_loc") ?? ""),
      pana_la_loc: String(date.get("pana_la_loc") ?? ""),
      scop: String(date.get("scop") ?? ""),
      // Text, nu `Number()`: golul trebuie să ajungă la schemă ca gol, nu ca 0.
      km_plecare: String(date.get("km_plecare") ?? "").trim(),
      km_sosire: String(date.get("km_sosire") ?? "").trim(),
      observatii: String(date.get("observatii") ?? "").trim() || null,
    };
    if (cursa !== null) return actualizeazaCursa({ ...comun, id: cursa.id });
    const sablon = String(date.get("sablon_id") ?? "");
    return adaugaCursa({ ...comun, sablon_id: sablon === "" ? null : sablon });
  }

  const sablon = sabloane.find((s) => s.id === sablonId) ?? null;
  const implicite = impliciteCursa(cursa, propunere, sablon);

  return (
    <FormularDialog
      declansator={
        cursa === null
          ? {
              eticheta: "Cursă nouă",
              varianta: "secundar",
              pictograma: <Plus aria-hidden="true" className="size-4" />,
              disabled: propunere.blocata,
            }
          : {
              eticheta: <Pencil aria-hidden="true" className="size-4" />,
              varianta: "tertiar",
              marime: "iconita",
              "aria-label": `Modifică cursa ${cursa.de_la_loc ?? ""} → ${cursa.pana_la_loc ?? ""}`,
            }
      }
      titlu={cursa === null ? "Cursă nouă" : "Modifică cursa"}
      descriere={
        cursa === null
          ? `Pleacă de la ${propunere.kmPlecare.toLocaleString("ro-RO")} km. O cursă încă pe drum se salvează fără sosire și se încheie mai târziu.`
          : "Cursele se corectează doar cât foaia e ciornă."
      }
      actiune={trimite}
      mesajReusita={cursa === null ? "Cursa a fost adăugată." : "Cursa a fost modificată."}
      etichetaTrimite={cursa === null ? "Adaugă cursa" : "Salvează"}
      textInCurs="Se salvează…"
      laReusita={() => {
        setSablonId("");
      }}
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          {cursa === null && sabloane.length > 0 ? (
            <Camp
              nume="sablon_id"
              id={idc("sablon_id")}
              eticheta="Din șablon"
              fel="select"
              ajutor="Rutele recurente ale firmei completează locurile, scopul și km estimați."
              className="sm:col-span-2"
              erori={[]}
            >
              {(a) => (
                <select
                  {...a}
                  value={sablonId}
                  onChange={(e) => {
                    setSablonId(e.target.value);
                  }}
                >
                  <option value="">Fără șablon</option>
                  {sabloane.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.denumire}
                    </option>
                  ))}
                </select>
              )}
            </Camp>
          ) : null}
          <div key={sablonId} className="contents">
            <Camp
              nume="plecare_la"
              id={idc("plecare_la")}
              eticheta="Plecare"
              obligatoriu
              erori={stare.erori["plecare_la"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="datetime-local"
                  defaultValue={stare.valoriTrimise["plecare_la"] ?? implicite.plecare_la}
                />
              )}
            </Camp>
            <Camp
              nume="sosire_la"
              id={idc("sosire_la")}
              eticheta="Sosire"
              ajutor="Goală cât cursa e pe drum."
              erori={stare.erori["sosire_la"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="datetime-local"
                  defaultValue={stare.valoriTrimise["sosire_la"] ?? implicite.sosire_la}
                />
              )}
            </Camp>
            <Camp
              nume="de_la_loc"
              id={idc("de_la_loc")}
              eticheta="De la"
              obligatoriu
              erori={stare.erori["de_la_loc"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  maxLength={200}
                  defaultValue={stare.valoriTrimise["de_la_loc"] ?? implicite.de_la_loc}
                />
              )}
            </Camp>
            <Camp
              nume="pana_la_loc"
              id={idc("pana_la_loc")}
              eticheta="Până la"
              obligatoriu
              erori={stare.erori["pana_la_loc"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  maxLength={200}
                  defaultValue={stare.valoriTrimise["pana_la_loc"] ?? implicite.pana_la_loc}
                />
              )}
            </Camp>
            <Camp
              nume="scop"
              id={idc("scop")}
              eticheta="Scopul deplasării"
              obligatoriu
              className="sm:col-span-2"
              erori={stare.erori["scop"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  maxLength={500}
                  defaultValue={stare.valoriTrimise["scop"] ?? implicite.scop}
                />
              )}
            </Camp>
            <Camp
              nume="km_plecare"
              id={idc("km_plecare")}
              eticheta="Km la plecare"
              obligatoriu
              erori={stare.erori["km_plecare"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  defaultValue={stare.valoriTrimise["km_plecare"] ?? implicite.km_plecare}
                />
              )}
            </Camp>
            <Camp
              nume="km_sosire"
              id={idc("km_sosire")}
              eticheta="Km la sosire"
              ajutor="Gol cât cursa e pe drum."
              erori={stare.erori["km_sosire"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  defaultValue={stare.valoriTrimise["km_sosire"] ?? implicite.km_sosire}
                />
              )}
            </Camp>
          </div>
        </div>
      )}
    </FormularDialog>
  );
}
