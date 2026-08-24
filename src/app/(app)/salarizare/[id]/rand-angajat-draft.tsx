// src/app/(app)/salarizare/[id]/rand-angajat-draft.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Trash2 } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { formatLei } from "@/lib/format/money";
import { ETICHETE_TIP_PRIMA, ETICHETE_TIP_RETINERE } from "@/domain/payroll/etichete";
import type { RandPrimaPerioada, RandRetinerePerioada } from "@/lib/queries/payroll";
import { adaugaPrima, adaugaRetinere, stergePrima, stergeRetinere } from "../actions";

const TIPURI_PRIMA = Object.keys(ETICHETE_TIP_PRIMA);
const TIPURI_RETINERE = Object.keys(ETICHETE_TIP_RETINERE);

interface Proprietati {
  readonly periodId: string;
  readonly employeeId: string;
  readonly nume: string;
  readonly salariuBaza: number;
  readonly prime: readonly RandPrimaPerioada[];
  readonly retineri: readonly RandRetinerePerioada[];
  /** `payroll:update` — dreptul de a corecta o ajustare introdusă greșit. */
  readonly poateSterge: boolean;
}

/** Ajustarea pentru care se așteaptă confirmarea ștergerii. */
type DeSters = Readonly<{
  fel: "prima" | "retinere";
  id: string;
  eticheta: string;
  suma: string;
}>;

export function RandAngajatDraft({
  periodId,
  employeeId,
  nume,
  salariuBaza,
  prime,
  retineri,
  poateSterge,
}: Proprietati) {
  const router = useRouter();
  const [formular, setFormular] = useState<"prima" | "retinere" | null>(null);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  /*
   * O primă tastată greșit nu se putea nici corecta, nici șterge: modulul avea
   * `adaugaPrima` și `adaugaRetinere` și nimic altceva, iar suma greșită intra
   * în calcul așa cum era. Ștergerea e soft delete, iar politica RLS o
   * acceptă doar cât timp perioada e ÎNCĂ în ciornă.
   */
  const [deSters, setDeSters] = useState<DeSters | null>(null);
  const idTip = useId();
  const idSuma = useId();
  const idMotiv = useId();
  const idProcent = useId();

  function trimitePrima(fd: FormData): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await adaugaPrima({
        period_id: periodId,
        employee_id: employeeId,
        tip: String(fd.get("tip")),
        suma: Number(fd.get("suma")),
        motiv: String(fd.get("motiv") ?? ""),
        impozabil: fd.get("impozabil") === "on",
        supus_contributii: fd.get("supus_contributii") === "on",
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setFormular(null);
      router.refresh();
    });
  }

  function trimiteRetinere(fd: FormData): void {
    setEroare(null);
    porneste(async () => {
      const procentBrut = String(fd.get("procent_maxim_din_net") ?? "").trim();
      const rezultat = await adaugaRetinere({
        period_id: periodId,
        employee_id: employeeId,
        tip: String(fd.get("tip")),
        suma: Number(fd.get("suma")),
        procent_maxim_din_net: procentBrut === "" ? null : Number(procentBrut),
        motiv: String(fd.get("motiv") ?? ""),
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setFormular(null);
      router.refresh();
    });
  }

  function confirmaStergerea(tinta: DeSters): void {
    setEroare(null);
    porneste(async () => {
      const rezultat =
        tinta.fel === "prima"
          ? await stergePrima({ id: tinta.id })
          : await stergeRetinere({ id: tinta.id });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">{nume}</p>
          <p className="text-muted-foreground text-corp">
            Salariu de bază: {formatLei(salariuBaza)}
          </p>
        </div>
        <div className="flex gap-2">
          <Buton
            varianta="secundar"
            onClick={() => {
              setEroare(null);
              setFormular(formular === "prima" ? null : "prima");
            }}
          >
            + Bonus
          </Buton>
          <Buton
            varianta="secundar"
            onClick={() => {
              setEroare(null);
              setFormular(formular === "retinere" ? null : "retinere");
            }}
          >
            + Reținere
          </Buton>
        </div>
      </div>

      {prime.length === 0 && retineri.length === 0 ? null : (
        <ul className="text-corp space-y-1">
          {prime.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <span className="text-success">+ {formatLei(p.suma)}</span>
              <span className="text-muted-foreground min-w-0 flex-1">
                {ETICHETE_TIP_PRIMA[p.tip] ?? p.tip} — {p.motiv}
              </span>
              {!poateSterge ? null : (
                <Buton
                  varianta="tertiar"
                  marime="iconita"
                  aria-label={`Șterge prima de ${formatLei(p.suma)}`}
                  onClick={() => {
                    setDeSters({
                      fel: "prima",
                      id: p.id,
                      eticheta: `${ETICHETE_TIP_PRIMA[p.tip] ?? p.tip} — ${p.motiv}`,
                      suma: formatLei(p.suma),
                    });
                  }}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Buton>
              )}
            </li>
          ))}
          {retineri.map((r) => (
            <li key={r.id} className="flex items-center gap-2">
              <span className="text-danger">− {formatLei(r.suma)}</span>
              <span className="text-muted-foreground min-w-0 flex-1">
                {ETICHETE_TIP_RETINERE[r.tip] ?? r.tip} — {r.motiv}
              </span>
              {!poateSterge ? null : (
                <Buton
                  varianta="tertiar"
                  marime="iconita"
                  aria-label={`Șterge reținerea de ${formatLei(r.suma)}`}
                  onClick={() => {
                    setDeSters({
                      fel: "retinere",
                      id: r.id,
                      eticheta: `${ETICHETE_TIP_RETINERE[r.tip] ?? r.tip} — ${r.motiv}`,
                      suma: formatLei(r.suma),
                    });
                  }}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Buton>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmareActiune
        deschis={deSters !== null}
        laInchidere={() => {
          setDeSters(null);
        }}
        titlu={deSters?.fel === "retinere" ? "Ștergeți reținerea?" : "Ștergeți prima?"}
        consecinta="Suma iese din calculul lunii. Ștergerea se poate face doar cât perioada e în ciornă; după calcul, corecția cere o redeschidere."
        cifre={
          deSters === null
            ? []
            : [
                { eticheta: "Angajat", valoare: nume },
                { eticheta: "Ajustare", valoare: deSters.eticheta },
                { eticheta: "Sumă", valoare: deSters.suma },
              ]
        }
        etichetaConfirmare="Șterge"
        distructiv
        inCurs={inCurs}
        laConfirmare={() => {
          const tinta = deSters;
          setDeSters(null);
          if (tinta !== null) confirmaStergerea(tinta);
        }}
      />

      {formular === "prima" ? (
        <form
          action={trimitePrima}
          className="border-border rounded-control grid gap-3 border p-3 sm:grid-cols-2"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={idTip} className="text-corp">
              Tip primă
            </label>
            <select
              id={idTip}
              name="tip"
              required
              className="border-foreground/60 rounded-control text-corp border px-3 py-2"
            >
              {TIPURI_PRIMA.map((tip) => (
                <option key={tip} value={tip}>
                  {ETICHETE_TIP_PRIMA[tip]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idSuma} className="text-corp">
              Sumă (lei)
            </label>
            <input
              id={idSuma}
              name="suma"
              type="number"
              step="0.01"
              min={0.01}
              required
              className="border-foreground/60 rounded-control text-corp border px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor={idMotiv} className="text-corp">
              Motiv
            </label>
            <textarea
              id={idMotiv}
              name="motiv"
              required
              maxLength={500}
              rows={2}
              className="border-foreground/60 rounded-control text-corp border px-3 py-2"
            />
          </div>
          <div className="text-corp flex flex-wrap gap-6 sm:col-span-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="impozabil" defaultChecked />
              Impozabilă
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="supus_contributii" defaultChecked />
              Supusă CAS/CASS
            </label>
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
              Adaugă bonusul
            </Buton>
            {eroare === null ? null : (
              <p role="alert" className="text-danger text-corp">
                {eroare}
              </p>
            )}
          </div>
        </form>
      ) : null}

      {formular === "retinere" ? (
        <form
          action={trimiteRetinere}
          className="border-border rounded-control grid gap-3 border p-3 sm:grid-cols-2"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={idTip} className="text-corp">
              Tip reținere
            </label>
            <select
              id={idTip}
              name="tip"
              required
              className="border-foreground/60 rounded-control text-corp border px-3 py-2"
            >
              {TIPURI_RETINERE.map((tip) => (
                <option key={tip} value={tip}>
                  {ETICHETE_TIP_RETINERE[tip]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idSuma} className="text-corp">
              Sumă (lei)
            </label>
            <input
              id={idSuma}
              name="suma"
              type="number"
              step="0.01"
              min={0.01}
              required
              className="border-foreground/60 rounded-control text-corp border px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idProcent} className="text-corp">
              Plafon (fracție din net, gol = fără plafon)
            </label>
            <input
              id={idProcent}
              name="procent_maxim_din_net"
              type="number"
              step="0.01"
              min={0}
              max={1}
              className="border-foreground/60 rounded-control text-corp border px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor={idMotiv} className="text-corp">
              Motiv
            </label>
            <textarea
              id={idMotiv}
              name="motiv"
              required
              maxLength={500}
              rows={2}
              className="border-foreground/60 rounded-control text-corp border px-3 py-2"
            />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
              Adaugă reținerea
            </Buton>
            {eroare === null ? null : (
              <p role="alert" className="text-danger text-corp">
                {eroare}
              </p>
            )}
          </div>
        </form>
      ) : null}
    </div>
  );
}
