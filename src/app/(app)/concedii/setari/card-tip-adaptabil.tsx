// src/app/(app)/concedii/setari/card-tip-adaptabil.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import type { TipConcediuConfigurabil } from "@/lib/queries/leave";
import { MODURI_ROTUNJIRE_ACUMULARE, type ModRotunjireAcumulare } from "@/schemas/leave";

import { actualizeazaTipConcediu, comutaActivTipConcediu } from "./actions";
import { ETICHETE_MOD_ROTUNJIRE } from "../etichete";

const CLASA_CAMP = "w-full rounded-control border border-foreground/60 px-2 py-1.5 text-corp";

/** O regulă a companiei — editabilă direct, câmp cu câmp, salvată dintr-o dată. */
export function CardTipAdaptabil({ tip }: { readonly tip: TipConcediuConfigurabil }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [reusit, setReusit] = useState(false);

  const [zileImplicite, setZileImplicite] = useState(String(tip.zile_implicite));
  const [seReporteaza, setSeReporteaza] = useState(tip.se_reporteaza);
  const [termenReportare, setTermenReportare] = useState(
    tip.termen_reportare === null ? "" : String(tip.termen_reportare),
  );
  const [plafonReportare, setPlafonReportare] = useState(
    tip.plafon_reportare_zile === null ? "" : String(tip.plafon_reportare_zile),
  );
  const [necesitaDocument, setNecesitaDocument] = useState(tip.necesita_document);
  const [modRotunjire, setModRotunjire] = useState<ModRotunjireAcumulare>(
    tip.mod_rotunjire_acumulare,
  );
  const [culoare, setCuloare] = useState(tip.culoare);

  const id = {
    zile: useId(),
    seReporteaza: useId(),
    termen: useId(),
    plafon: useId(),
    document: useId(),
    rotunjire: useId(),
    culoare: useId(),
  };

  function trimite(): void {
    setEroare(null);
    setReusit(false);
    porneste(async () => {
      const rezultat = await actualizeazaTipConcediu({
        id: tip.id,
        zile_implicite: Number(zileImplicite),
        se_reporteaza: seReporteaza,
        termen_reportare: termenReportare.trim() === "" ? null : Number(termenReportare),
        plafon_reportare_zile: plafonReportare.trim() === "" ? null : Number(plafonReportare),
        necesita_document: necesitaDocument,
        mod_rotunjire_acumulare: modRotunjire,
        culoare,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setReusit(true);
      router.refresh();
    });
  }

  function comutaActiv(activ: boolean): void {
    porneste(async () => {
      await comutaActivTipConcediu({ id: tip.id, activ });
      router.refresh();
    });
  }

  return (
    <div className="border-border rounded-panou space-y-3 border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-corp flex items-center gap-2 font-medium">
          <span
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: culoare }}
            aria-hidden="true"
          />
          {tip.denumire}
        </p>
        <label className="text-muted-foreground text-nota flex items-center gap-2">
          <input
            type="checkbox"
            checked={tip.activ}
            disabled={inCurs}
            onChange={(e) => {
              comutaActiv(e.target.checked);
            }}
          />
          Activ
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={id.zile} className="text-muted-foreground text-nota">
            Zile / an
          </label>
          <input
            id={id.zile}
            type="number"
            min={0}
            max={1100}
            value={zileImplicite}
            onChange={(e) => {
              setZileImplicite(e.target.value);
            }}
            className={CLASA_CAMP}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.culoare} className="text-muted-foreground text-nota">
            Culoare (calendar)
          </label>
          <input
            id={id.culoare}
            type="color"
            value={culoare}
            onChange={(e) => {
              setCuloare(e.target.value);
            }}
            className="border-foreground/60 rounded-control h-9 w-full border"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.termen} className="text-muted-foreground text-nota">
            Termen de reportare (luni)
          </label>
          <input
            id={id.termen}
            type="number"
            min={1}
            max={60}
            placeholder="—"
            value={termenReportare}
            disabled={!seReporteaza}
            onChange={(e) => {
              setTermenReportare(e.target.value);
            }}
            className={`${CLASA_CAMP} disabled:bg-surface disabled:text-muted-foreground`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={id.plafon} className="text-muted-foreground text-nota">
            Plafon de reportare (zile)
          </label>
          <input
            id={id.plafon}
            type="number"
            min={0}
            max={1100}
            placeholder="fără plafon"
            value={plafonReportare}
            disabled={!seReporteaza}
            onChange={(e) => {
              setPlafonReportare(e.target.value);
            }}
            className={`${CLASA_CAMP} disabled:bg-surface disabled:text-muted-foreground`}
          />
        </div>

        <div className="col-span-2 flex flex-col gap-1">
          <label htmlFor={id.rotunjire} className="text-muted-foreground text-nota">
            Rotunjirea acumulării proporționale
          </label>
          <select
            id={id.rotunjire}
            value={modRotunjire}
            onChange={(e) => {
              setModRotunjire(e.target.value as ModRotunjireAcumulare);
            }}
            className={CLASA_CAMP}
          >
            {MODURI_ROTUNJIRE_ACUMULARE.map((mod) => (
              <option key={mod} value={mod}>
                {ETICHETE_MOD_ROTUNJIRE[mod]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="text-corp flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={seReporteaza}
            onChange={(e) => {
              setSeReporteaza(e.target.checked);
            }}
          />
          Se reportează în anul următor
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={necesitaDocument}
            onChange={(e) => {
              setNecesitaDocument(e.target.checked);
            }}
          />
          Necesită document atașat
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Buton varianta="primar" inCurs={inCurs} textInCurs="Se salvează…" onClick={trimite}>
          Salvează
        </Buton>
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-corp">
            {eroare}
          </p>
        )}
        {reusit ? (
          <p role="status" className="text-foreground text-corp">
            Salvat.
          </p>
        ) : null}
      </div>
    </div>
  );
}
