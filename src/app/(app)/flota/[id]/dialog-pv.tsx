"use client";

// src/app/(app)/flota/[id]/dialog-pv.tsx
//
// Caseta de întocmire și de editare a ciornei procesului-verbal (0215, F12c).
// `useTransition` + `FormData` + `useId` prin `FormularDialog` (NU
// react-hook-form). Traducerea câmpurilor stă în `valori-pv.ts`, singurul loc.
//
// Se deschide prin parametru (`?pv=nou&predata=…&primita=…`) cu `deschisInitial`
// + `key` dat de pagină: fără `key`, o navigare pe aceeași rută nu remontează
// caseta (vault, `[[modul/flota]]`).

import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";

import { Camp, clasaBifa, clasaControl } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import {
  ANVELOPE_PV,
  DOCUMENTE_BORD_PV,
  DOTARI_PV,
  ETICHETE_ANVELOPE_PV,
  ETICHETE_DOCUMENTE_BORD,
  ETICHETE_DOTARI,
  ETICHETE_NIVEL_REZERVOR,
  ETICHETE_STARE_GENERALA,
  ETICHETE_TIP_PV,
  ETICHETE_ZONE_DAUNA,
  MAXIM_DAUNE,
  NIVELURI_REZERVOR,
  STARI_GENERALE,
  ZONE_DAUNA,
  dotariObligatoriiPentru,
  etichetaNivel,
  tipPv,
  type DaunaPv,
} from "@/domain/fleet/proces-verbal";
import type { CategorieVehicul, Combustibil } from "@/schemas/fleet";

import { actualizeazaPv, creeazaPv } from "./pv/actions";
import { valoriPv } from "./valori-pv";

export type InitialePv = Readonly<{
  km_bord: number | null;
  nivel_rezervor: string | null;
  numar_chei: number | null;
  stare_generala: string | null;
  anvelope: string | null;
  documente_bord: readonly string[];
  dotari: readonly string[];
  daune_constatate: boolean | null;
  daune: readonly DaunaPv[];
  observatii: string | null;
}>;

interface Proprietati {
  readonly vehiculId: string;
  readonly categorie: CategorieVehicul;
  readonly combustibil: Combustibil;
  /** `null` = PV nou; altfel id-ul ciornei editate. */
  readonly pvId: string | null;
  readonly alocari: Readonly<{ predata: string | null; primita: string | null }>;
  /** Kilometrajul alocării: dacă există, PV-ul trebuie să-l repete (baza refuză altul). */
  readonly kmAlocare: number | null;
  readonly initiale: InitialePv;
  /** Cine predă și cine primește, gata scris de pagină. */
  readonly parti: string;
  readonly avertismente: readonly string[];
  readonly deschisInitial?: boolean;
  readonly etichetaDeclansator: string;
}

/** Lista de daune: rânduri adăugate și șterse în casetă, trimise ca JSON. */
function ListaDaune({
  initiale,
  erori,
  idc,
}: Readonly<{
  initiale: readonly DaunaPv[];
  erori: readonly string[];
  idc: (s: string) => string;
}>): ReactElement {
  const [randuri, setRanduri] = useState<{ zona: string; descriere: string }[]>(() =>
    initiale.map((d) => ({ zona: d.zona, descriere: d.descriere })),
  );
  const idEroare = idc("daune-eroare");
  return (
    <div className="space-y-2">
      <input type="hidden" name="daune" value={JSON.stringify(randuri)} />
      {randuri.map((r, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
          <label className="sr-only" htmlFor={idc(`zona-${String(i)}`)}>
            Zona daunei {i + 1}
          </label>
          <select
            id={idc(`zona-${String(i)}`)}
            className={clasaControl({ fel: "select" })}
            value={r.zona}
            onChange={(e) => {
              const zona = e.target.value;
              setRanduri((v) => v.map((x, j) => (j === i ? { ...x, zona } : x)));
            }}
          >
            {ZONE_DAUNA.map((z) => (
              <option key={z} value={z}>
                {ETICHETE_ZONE_DAUNA[z]}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor={idc(`descriere-${String(i)}`)}>
            Descrierea daunei {i + 1}
          </label>
          <input
            id={idc(`descriere-${String(i)}`)}
            className={clasaControl()}
            maxLength={300}
            value={r.descriere}
            placeholder="Ce s-a constatat"
            onChange={(e) => {
              const descriere = e.target.value;
              setRanduri((v) => v.map((x, j) => (j === i ? { ...x, descriere } : x)));
            }}
          />
          <button
            type="button"
            className="text-corp text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            onClick={() => setRanduri((v) => v.filter((_, j) => j !== i))}
          >
            Șterge
          </button>
        </div>
      ))}
      {randuri.length < MAXIM_DAUNE ? (
        <button
          type="button"
          className="text-corp underline-offset-2 hover:underline"
          onClick={() => setRanduri((v) => [...v, { zona: "fata", descriere: "" }])}
        >
          Adaugă o daună
        </button>
      ) : null}
      {erori.length > 0 ? (
        <p id={idEroare} className="text-danger text-nota">
          {erori.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

export function DialogPv({
  vehiculId,
  categorie,
  combustibil,
  pvId,
  alocari,
  kmAlocare,
  initiale,
  parti,
  avertismente,
  deschisInitial = false,
  etichetaDeclansator,
}: Proprietati): ReactElement {
  const router = useRouter();
  const tip = tipPv({ predataId: alocari.predata, primitaId: alocari.primita });
  const obligatorii = new Set<string>(dotariObligatoriiPentru(categorie));

  async function trimite(date: FormData) {
    const valori = valoriPv(date);
    return pvId === null
      ? creeazaPv({
          ...valori,
          vehicle_id: vehiculId,
          alocare_predata_id: alocari.predata,
          alocare_primita_id: alocari.primita,
        })
      : actualizeazaPv({ ...valori, id: pvId, vehicle_id: vehiculId });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: etichetaDeclansator,
        varianta: pvId === null ? "secundar" : "tertiar",
      }}
      titlu={
        tip === null ? "Proces-verbal" : `Proces-verbal: ${ETICHETE_TIP_PV[tip].toLowerCase()}`
      }
      descriere={`${parti}. Ciorna nu are număr; îl primește la finalizare, odată cu înregistrarea în registru.`}
      deschisInitial={deschisInitial}
      redimensionabil
      actiune={trimite}
      mesajReusita={
        pvId === null ? "Ciorna procesului-verbal a fost întocmită." : "Ciorna a fost salvată."
      }
      etichetaTrimite={pvId === null ? "Întocmește ciorna" : "Salvează ciorna"}
      textInCurs="Se salvează…"
      laReusita={(data: Readonly<{ id: string }>) => {
        if (pvId === null) router.push(`/flota/${vehiculId}/pv/${data.id}`);
      }}
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="km_bord"
            id={idc("km_bord")}
            eticheta="Kilometraj la bord"
            ajutor={
              kmAlocare === null
                ? "Alocarea nu are kilometraj: îl primește pe acesta la finalizare."
                : "E kilometrajul alocării; procesul-verbal trebuie să-l repete."
            }
            erori={stare.erori["km_bord"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                readOnly={kmAlocare !== null}
                defaultValue={
                  stare.valoriTrimise["km_bord"] ??
                  (initiale.km_bord === null ? "" : String(initiale.km_bord))
                }
              />
            )}
          </Camp>
          <Camp
            nume="nivel_rezervor"
            id={idc("nivel_rezervor")}
            eticheta={etichetaNivel(combustibil)}
            fel="select"
            erori={stare.erori["nivel_rezervor"] ?? []}
          >
            {(a) => (
              <select
                {...a}
                defaultValue={
                  stare.valoriTrimise["nivel_rezervor"] ?? initiale.nivel_rezervor ?? ""
                }
              >
                <option value="">Necompletat</option>
                {NIVELURI_REZERVOR.map((n) => (
                  <option key={n} value={n}>
                    {ETICHETE_NIVEL_REZERVOR[n]}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          <Camp
            nume="numar_chei"
            id={idc("numar_chei")}
            eticheta="Număr de chei"
            erori={stare.erori["numar_chei"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                min="0"
                max="10"
                step="1"
                inputMode="numeric"
                defaultValue={
                  stare.valoriTrimise["numar_chei"] ??
                  (initiale.numar_chei === null ? "" : String(initiale.numar_chei))
                }
              />
            )}
          </Camp>
          <Camp
            nume="stare_generala"
            id={idc("stare_generala")}
            eticheta="Starea generală"
            fel="select"
            erori={stare.erori["stare_generala"] ?? []}
          >
            {(a) => (
              <select
                {...a}
                defaultValue={
                  stare.valoriTrimise["stare_generala"] ?? initiale.stare_generala ?? ""
                }
              >
                <option value="">Necompletat</option>
                {STARI_GENERALE.map((s) => (
                  <option key={s} value={s}>
                    {ETICHETE_STARE_GENERALA[s]}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          <Camp
            nume="anvelope"
            id={idc("anvelope")}
            eticheta="Anvelope"
            fel="select"
            erori={stare.erori["anvelope"] ?? []}
          >
            {(a) => (
              <select
                {...a}
                defaultValue={stare.valoriTrimise["anvelope"] ?? initiale.anvelope ?? ""}
              >
                <option value="">Necompletat</option>
                {ANVELOPE_PV.map((x) => (
                  <option key={x} value={x}>
                    {ETICHETE_ANVELOPE_PV[x]}
                  </option>
                ))}
              </select>
            )}
          </Camp>

          <fieldset className="space-y-1 sm:col-span-2">
            <legend className="text-corp mb-1 font-medium">Documente la bord</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {DOCUMENTE_BORD_PV.map((cod) => (
                <label key={cod} className="text-corp flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="documente_bord"
                    value={cod}
                    className={clasaBifa}
                    defaultChecked={initiale.documente_bord.includes(cod)}
                  />
                  {ETICHETE_DOCUMENTE_BORD[cod]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-1 sm:col-span-2">
            <legend className="text-corp mb-1 font-medium">Dotări</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {DOTARI_PV.map((cod) => (
                <label key={cod} className="text-corp flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="dotari"
                    value={cod}
                    className={clasaBifa}
                    defaultChecked={initiale.dotari.includes(cod)}
                  />
                  {ETICHETE_DOTARI[cod]}
                  {obligatorii.has(cod) ? (
                    <span className="text-muted-foreground text-nota">(obligatorie)</span>
                  ) : null}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-corp mb-1 font-medium">S-au constatat daune vizibile?</legend>
            <div className="flex gap-6">
              {(["da", "nu"] as const).map((v) => (
                <label key={v} className="text-corp flex items-center gap-2">
                  <input
                    type="radio"
                    name="daune_constatate"
                    value={v}
                    className={clasaBifa}
                    defaultChecked={
                      initiale.daune_constatate !== null &&
                      initiale.daune_constatate === (v === "da")
                    }
                  />
                  {v === "da" ? "Da" : "Nu"}
                </label>
              ))}
            </div>
            {(stare.erori["daune_constatate"] ?? []).length > 0 ? (
              <p className="text-danger text-nota">
                {(stare.erori["daune_constatate"] ?? []).join(" ")}
              </p>
            ) : null}
            <ListaDaune initiale={initiale.daune} erori={stare.erori["daune"] ?? []} idc={idc} />
          </fieldset>

          <Camp
            nume="observatii"
            id={idc("observatii")}
            eticheta="Observații"
            fel="textarea"
            ajutor="Ce nu intră în rubrici: o dotare în plus, starea bateriei la un hibrid plug-in."
            className="sm:col-span-2"
            erori={stare.erori["observatii"] ?? []}
          >
            {(a) => (
              <textarea
                {...a}
                maxLength={2000}
                rows={3}
                defaultValue={stare.valoriTrimise["observatii"] ?? initiale.observatii ?? ""}
              />
            )}
          </Camp>

          {avertismente.length > 0 ? (
            <ul className="text-corp border-border rounded-panou list-disc space-y-1 border p-3 pl-7 sm:col-span-2">
              {avertismente.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
          {(stare.erori["alocare_primita_id"] ?? []).length > 0 ? (
            <p className="text-danger text-corp sm:col-span-2">
              {(stare.erori["alocare_primita_id"] ?? []).join(" ")}
            </p>
          ) : null}
        </div>
      )}
    </FormularDialog>
  );
}
