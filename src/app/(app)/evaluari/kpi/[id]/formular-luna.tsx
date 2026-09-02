"use client";

// src/app/(app)/evaluari/kpi/[id]/formular-luna.tsx

/**
 * Completarea liniilor lunii.
 *
 * ── DE CE PROCENTUL SE ARATĂ ÎN TIMP CE SE TASTEAZĂ ───────────────────────
 * `procentLinie` e o funcție pură, deci se poate rula și în client. Managerul
 * vede imediat că „1,4 % rebut la o țintă de 2 %" înseamnă 130 %, nu 70 % —
 * adică vede sensul indicatorului aplicat, nu doar declarat. Cifra finală
 * rămâne cea calculată pe server, la salvare, din ce e efectiv în bază.
 *
 * ── DE CE LUNA ÎNCHISĂ NU ARE FORMULAR, DELOC ────────────────────────────
 * Nu e o ascundere cosmetică: politica de UPDATE din 0119 cere
 * `status = 'draft'` în `USING`, deci un rând finalizat nu mai poate fi atins
 * de nicio scriere. Un formular randat ar fi promis o acțiune imposibilă.
 */

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Camp, clasaControl } from "@/components/ui/camp";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { Formular } from "@/components/ui/formular";
import { arataToast } from "@/components/ui/toast";
import { procentLinie } from "@/domain/evaluations/kpi";
import type { LunaKpi } from "@/lib/queries/kpi";

import { ETICHETE_SENS_KPI } from "@/domain/evaluations/kpi-vocabular";
import { formatValoare, tonKpi } from "../etichete";
import { finalizeazaLunaKpi, salveazaLunaKpi } from "../actions";

interface ValoareFormular {
  readonly cod: string;
  readonly realizat: string;
  readonly nota: string;
  readonly comentariu: string;
}

const TONURI_TEXT: Readonly<Record<ReturnType<typeof tonKpi>, string>> = {
  bun: "text-succes",
  neutru: "text-foreground",
  atentie: "text-atentie",
  rau: "text-pericol",
};

export function FormularLuna({
  luna,
  poateEdita,
}: Readonly<{ luna: LunaKpi; poateEdita: boolean }>): ReactElement {
  const [valori, setValori] = useState<readonly ValoareFormular[]>(() =>
    luna.valori.map((v) => ({
      cod: v.cod,
      realizat: v.realizat === null ? "" : String(v.realizat),
      nota: v.nota === null ? "" : String(v.nota),
      comentariu: v.comentariu ?? "",
    })),
  );
  const [deConfirmat, setDeConfirmat] = useState(false);
  const [seInchide, porneste] = useTransition();
  const router = useRouter();

  /**
   * Închiderea nu trece prin `<Formular>`, ci prin `useTransition` — tiparul din
   * `actiuni-set.tsx`. Un al doilea `<form>` doar pentru butonul dialogului ar fi
   * cerut ca dialogul să-i trimită formularul din afara lui, iar singura cale ar
   * fi fost o interogare în DOM: exact genul de legătură care se rupe tăcut la
   * prima redenumire.
   */
  const inchideLuna = () => {
    porneste(async () => {
      const date = new FormData();
      date.set("id", luna.id);
      const rezultat = await finalizeazaLunaKpi(date);
      setDeConfirmat(false);
      if (rezultat.ok) {
        arataToast({ fel: "reusita", text: "Luna a fost închisă." });
        router.refresh();
        return;
      }
      arataToast({ fel: "eroare", text: rezultat.error.message });
    });
  };

  const schimba = (cod: string, camp: keyof ValoareFormular, valoare: string) => {
    setValori((prev) => prev.map((v) => (v.cod === cod ? { ...v, [camp]: valoare } : v)));
  };

  const numar = (text: string): number | null => {
    const curat = text.trim().replace(",", ".");
    if (curat === "") return null;
    const n = Number.parseFloat(curat);
    return Number.isFinite(n) ? n : null;
  };

  if (!poateEdita) {
    return (
      <section className="space-y-4">
        {luna.status === "finalizat" ? (
          <Callout fel="neutru" titlu="Luna e închisă">
            Valorile nu se mai pot schimba, nici de administrator. Corectura se face înainte de
            închidere, nu după.
          </Callout>
        ) : null}
        <TabelValori luna={luna} />
      </section>
    );
  }

  return (
    <>
      <Formular actiune={salveazaLunaKpi} mesajReusita="Luna a fost salvată." className="space-y-4">
        {(stare) => (
          <>
            <input type="hidden" name="id" value={luna.id} />
            <input
              type="hidden"
              name="valori"
              value={JSON.stringify(
                valori.map((v) => ({
                  cod: v.cod,
                  realizat: v.realizat.trim().replace(",", "."),
                  nota: v.nota.trim(),
                  comentariu: v.comentariu,
                })),
              )}
            />

            <div className="space-y-3">
              {luna.valori.map((linie) => {
                const curenta = valori.find((v) => v.cod === linie.cod);
                const masurat = linie.tip === "masurat";
                const procent = procentLinie({
                  ...linie,
                  realizat: masurat ? numar(curenta?.realizat ?? "") : null,
                  nota: masurat ? null : numar(curenta?.nota ?? ""),
                });

                return (
                  <div
                    key={linie.cod}
                    className="border-foreground/15 bg-card grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 sm:col-span-3">
                      <span className="font-medium">{linie.denumire}</span>
                      <span className="text-muted-foreground text-nota">
                        {masurat
                          ? `țintă ${formatValoare(linie.tinta, linie.unitate)} · ${
                              linie.sens === null ? "" : ETICHETE_SENS_KPI[linie.sens].toLowerCase()
                            }`
                          : `scală 1–${String(linie.scala_max ?? 5)}`}
                      </span>
                      <span className="text-muted-foreground text-nota ms-auto tabular-nums">
                        pondere {linie.pondere} %
                      </span>
                    </div>

                    <label className="flex flex-col gap-1">
                      <span className="text-eticheta text-muted-foreground font-medium">
                        {masurat ? "Realizat" : "Nota"}
                      </span>
                      {masurat ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          className={clasaControl({})}
                          value={curenta?.realizat ?? ""}
                          onChange={(e) => {
                            schimba(linie.cod, "realizat", e.target.value);
                          }}
                        />
                      ) : (
                        <select
                          className={clasaControl({ fel: "select" })}
                          value={curenta?.nota ?? ""}
                          onChange={(e) => {
                            schimba(linie.cod, "nota", e.target.value);
                          }}
                        >
                          <option value="">nenotat</option>
                          {Array.from({ length: (linie.scala_max ?? 5) + 1 }, (_, n) => n).map(
                            (n) => (
                              <option key={n} value={String(n)}>
                                {n}
                              </option>
                            ),
                          )}
                        </select>
                      )}
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-eticheta text-muted-foreground font-medium">
                        Comentariu
                      </span>
                      <input
                        type="text"
                        className={clasaControl({})}
                        maxLength={1000}
                        value={curenta?.comentariu ?? ""}
                        onChange={(e) => {
                          schimba(linie.cod, "comentariu", e.target.value);
                        }}
                      />
                    </label>

                    <p
                      className={`self-end text-right text-lg font-semibold tabular-nums ${
                        procent === null ? "text-muted-foreground" : TONURI_TEXT[tonKpi(procent)]
                      }`}
                    >
                      {procent === null ? "—" : `${String(procent)} %`}
                    </p>
                  </div>
                );
              })}
            </div>

            <Camp
              nume="concluzie"
              eticheta="Concluzia lunii"
              fel="textarea"
              ajutor="Se vede în portalul angajatului, împreună cu scorul."
              erori={stare.erori["concluzie"] ?? []}
            >
              {(a) => (
                <textarea
                  {...a}
                  rows={3}
                  maxLength={4000}
                  defaultValue={stare.valoriTrimise["concluzie"] ?? luna.concluzie ?? ""}
                />
              )}
            </Camp>

            <div className="flex flex-wrap gap-2">
              <Buton
                type="submit"
                varianta="primar"
                textInCurs="Se salvează…"
                inCurs={stare.inCurs}
              >
                Salvează
              </Buton>
              <Buton
                onClick={() => {
                  setDeConfirmat(true);
                }}
              >
                <Lock className="size-4" /> Închide luna
              </Buton>
            </div>
          </>
        )}
      </Formular>

      <ConfirmareActiune
        deschis={deConfirmat}
        laInchidere={() => {
          setDeConfirmat(false);
        }}
        titlu={`Închizi luna pentru ${luna.angajat ?? "angajat"}?`}
        consecinta="Luna închisă NU se mai redeschide — nici de administrator. Salvați întâi ce ați modificat: închiderea nu salvează liniile."
        etichetaConfirmare="Închide luna"
        distructiv
        inCurs={seInchide}
        laConfirmare={inchideLuna}
      />
    </>
  );
}

function TabelValori({ luna }: { readonly luna: LunaKpi }): ReactElement {
  return (
    <div className="space-y-2">
      {luna.valori.map((v) => (
        <div
          key={v.cod}
          className="border-foreground/15 bg-card flex flex-wrap items-baseline gap-x-3 rounded-lg border p-3"
        >
          <span className="font-medium">{v.denumire}</span>
          <span className="text-muted-foreground text-nota">
            {v.tip === "masurat"
              ? `${formatValoare(v.realizat, v.unitate)} din ${formatValoare(v.tinta, v.unitate)}`
              : `nota ${v.nota === null ? "—" : String(v.nota)} din ${String(v.scala_max ?? 5)}`}
          </span>
          {v.comentariu === null ? null : (
            <span className="text-muted-foreground text-nota">· {v.comentariu}</span>
          )}
          <span className="ms-auto font-semibold tabular-nums">
            {v.procent === null ? "—" : `${String(v.procent)} %`}
          </span>
        </div>
      ))}
      {luna.concluzie === null ? null : (
        <p className="text-muted-foreground border-foreground/15 rounded-lg border p-3">
          {luna.concluzie}
        </p>
      )}
    </div>
  );
}
