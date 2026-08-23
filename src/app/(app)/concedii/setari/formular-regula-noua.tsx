// src/app/(app)/concedii/setari/formular-regula-noua.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import type { OptiuneNomenclator, TipConcediuConfigurabil } from "@/lib/queries/leave";
import {
  CRITERII_GRILA,
  VALORI_CONDITII_MUNCA_GRILA,
  VALORI_GRAD_HANDICAP_GRILA,
  type CriteriuGrila,
} from "@/schemas/leave";

import { creeazaRegulaConcediu } from "./actions";
import {
  ETICHETE_CRITERIU_GRILA,
  ETICHETE_VALOARE_CONDITII_MUNCA,
  ETICHETE_VALOARE_GRAD_HANDICAP,
} from "../etichete";

const CLASA_CAMP = "w-full rounded-control border border-foreground/60 px-3 py-2 text-corp";

export function FormularRegulaNoua({
  tipuri,
  departamente,
  functii,
}: {
  readonly tipuri: readonly TipConcediuConfigurabil[];
  readonly departamente: readonly OptiuneNomenclator[];
  readonly functii: readonly OptiuneNomenclator[];
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [reusit, setReusit] = useState(false);

  const [leaveTypeId, setLeaveTypeId] = useState(tipuri[0]?.id ?? "");
  const [tipCriteriu, setTipCriteriu] = useState<CriteriuGrila>("vechime");
  const [vechimeAniMin, setVechimeAniMin] = useState("5");
  const [valoareCondMunca, setValoareCondMunca] = useState<string>(VALORI_CONDITII_MUNCA_GRILA[0]);
  const [valoareHandicap, setValoareHandicap] = useState<string>(VALORI_GRAD_HANDICAP_GRILA[0]);
  const [departmentId, setDepartmentId] = useState(departamente[0]?.id ?? "");
  const [jobPositionId, setJobPositionId] = useState(functii[0]?.id ?? "");
  const [zileSuplimentare, setZileSuplimentare] = useState("2");
  const [denumire, setDenumire] = useState("");
  const [valabilDeLa, setValabilDeLa] = useState("");
  const [valabilPanaLa, setValabilPanaLa] = useState("");

  const id = {
    tip: useId(),
    criteriu: useId(),
    vechime: useId(),
    condMunca: useId(),
    handicap: useId(),
    departament: useId(),
    functie: useId(),
    zile: useId(),
    denumire: useId(),
    deLa: useId(),
    panaLa: useId(),
  };

  function trimite(): void {
    if (leaveTypeId === "") {
      setEroare("Nu există niciun tip de concediu adaptabil pe care să atașați o grilă.");
      return;
    }
    setEroare(null);
    setReusit(false);
    porneste(async () => {
      const rezultat = await creeazaRegulaConcediu({
        leave_type_id: leaveTypeId,
        tip_criteriu: tipCriteriu,
        vechime_ani_min: tipCriteriu === "vechime" ? Number(vechimeAniMin) : null,
        valoare_text:
          tipCriteriu === "conditii_munca"
            ? valoareCondMunca
            : tipCriteriu === "grad_handicap"
              ? valoareHandicap
              : null,
        department_id: tipCriteriu === "departament" ? departmentId : null,
        job_position_id: tipCriteriu === "functie" ? jobPositionId : null,
        zile_suplimentare: Number(zileSuplimentare),
        denumire,
        valabil_de_la: valabilDeLa,
        valabil_pana_la: valabilPanaLa.trim() === "" ? null : valabilPanaLa,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setDenumire("");
      setReusit(true);
      router.refresh();
    });
  }

  return (
    <div className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-2 lg:grid-cols-3">
      <p className="text-corp font-medium sm:col-span-2 lg:col-span-3">O grilă nouă</p>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.tip} className="text-corp">
          Tip de concediu
        </label>
        <select
          id={id.tip}
          value={leaveTypeId}
          onChange={(e) => {
            setLeaveTypeId(e.target.value);
          }}
          className={CLASA_CAMP}
        >
          {tipuri.map((t) => (
            <option key={t.id} value={t.id}>
              {t.denumire}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.criteriu} className="text-corp">
          Criteriu
        </label>
        <select
          id={id.criteriu}
          value={tipCriteriu}
          onChange={(e) => {
            setTipCriteriu(e.target.value as CriteriuGrila);
          }}
          className={CLASA_CAMP}
        >
          {CRITERII_GRILA.map((c) => (
            <option key={c} value={c}>
              {ETICHETE_CRITERIU_GRILA[c]}
            </option>
          ))}
        </select>
      </div>

      {tipCriteriu === "vechime" ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={id.vechime} className="text-corp">
            Prag de vechime (ani)
          </label>
          <input
            id={id.vechime}
            type="number"
            min={0}
            max={60}
            value={vechimeAniMin}
            onChange={(e) => {
              setVechimeAniMin(e.target.value);
            }}
            className={CLASA_CAMP}
          />
        </div>
      ) : null}

      {tipCriteriu === "conditii_munca" ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={id.condMunca} className="text-corp">
            Condiții de muncă
          </label>
          <select
            id={id.condMunca}
            value={valoareCondMunca}
            onChange={(e) => {
              setValoareCondMunca(e.target.value);
            }}
            className={CLASA_CAMP}
          >
            {VALORI_CONDITII_MUNCA_GRILA.map((v) => (
              <option key={v} value={v}>
                {ETICHETE_VALOARE_CONDITII_MUNCA[v]}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {tipCriteriu === "grad_handicap" ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={id.handicap} className="text-corp">
            Grad de handicap
          </label>
          <select
            id={id.handicap}
            value={valoareHandicap}
            onChange={(e) => {
              setValoareHandicap(e.target.value);
            }}
            className={CLASA_CAMP}
          >
            {VALORI_GRAD_HANDICAP_GRILA.map((v) => (
              <option key={v} value={v}>
                {ETICHETE_VALOARE_GRAD_HANDICAP[v]}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {tipCriteriu === "departament" ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={id.departament} className="text-corp">
            Departament
          </label>
          <select
            id={id.departament}
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
            }}
            className={CLASA_CAMP}
          >
            {departamente.map((d) => (
              <option key={d.id} value={d.id}>
                {d.denumire}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {tipCriteriu === "functie" ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={id.functie} className="text-corp">
            Funcție
          </label>
          <select
            id={id.functie}
            value={jobPositionId}
            onChange={(e) => {
              setJobPositionId(e.target.value);
            }}
            className={CLASA_CAMP}
          >
            {functii.map((f) => (
              <option key={f.id} value={f.id}>
                {f.denumire}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor={id.zile} className="text-corp">
          Zile suplimentare
        </label>
        <input
          id={id.zile}
          type="number"
          min={0}
          max={60}
          value={zileSuplimentare}
          onChange={(e) => {
            setZileSuplimentare(e.target.value);
          }}
          className={CLASA_CAMP}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.denumire} className="text-corp">
          Denumire
        </label>
        <input
          id={id.denumire}
          type="text"
          maxLength={160}
          placeholder="Ex. Vechime peste 5 ani"
          value={denumire}
          onChange={(e) => {
            setDenumire(e.target.value);
          }}
          className={CLASA_CAMP}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.deLa} className="text-corp">
          Valabilă de la
        </label>
        <input
          id={id.deLa}
          type="date"
          value={valabilDeLa}
          onChange={(e) => {
            setValabilDeLa(e.target.value);
          }}
          className={CLASA_CAMP}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.panaLa} className="text-corp">
          Valabilă până la (opțional)
        </label>
        <input
          id={id.panaLa}
          type="date"
          value={valabilPanaLa}
          onChange={(e) => {
            setValabilPanaLa(e.target.value);
          }}
          className={CLASA_CAMP}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
        <Buton varianta="primar" inCurs={inCurs} textInCurs="Se salvează…" onClick={trimite}>
          Adaugă grila
        </Buton>
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-corp">
            {eroare}
          </p>
        )}
        {reusit ? (
          <p role="status" className="text-foreground text-corp">
            Grilă adăugată. Aplicați drepturile mai jos ca să ajungă la angajați.
          </p>
        ) : null}
      </div>
    </div>
  );
}
