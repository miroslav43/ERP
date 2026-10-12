// src/app/(app)/ticketing/nou/formular-tichet.tsx
"use client";

import { useCallback, useId, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import type { ActionResult } from "@/lib/actions/types";
import { TIPURI_TICHET, type TipTichet } from "@/domain/ticketing/stari";
import type { ObiectAlocat } from "@/lib/queries/ticketing";
import { DESCRIERI_TIP, ETICHETE_TIP } from "../etichete";
import { creeazaTichet } from "../actions";

type TichetCreat = Readonly<{ id: string }>;

/**
 * Un formular per tip, nu unul generic cu câmpuri ascunse. Tipul se alege
 * întâi, ca un pas separat: e singura decizie care schimbă tot restul, iar
 * amestecarea ei printre câmpuri ar face-o să pară o opțiune oarecare.
 */
/**
 * `prefixCale` există pentru portal: același formular, dar întors în
 * `/portal/tichetele-mele/<id>` în loc de `/ticketing/<id>`. Parametrizare, nu
 * copie: partea grea — alegerea tipului ca pas separat, câmpurile care depind de
 * el, obiectele din primire — ar fi de dublat întreagă, iar două exemplare ale
 * ei ar diverge la prima corectură.
 */
export function FormularTichet({
  obiecteAlocate,
  modulCurent,
  prefixCale = "/ticketing",
  obiectImplicit = null,
}: Readonly<{
  obiecteAlocate: readonly ObiectAlocat[];
  modulCurent: string;
  prefixCale?: string;
  /** `?obiect=<id>` din cardul „În primirea mea": tipul sare direct la defecțiune, pe obiectul ăla. */
  obiectImplicit?: string | null;
}>) {
  const router = useRouter();
  const id = useId();
  const [tip, setTip] = useState<TipTichet | null>(obiectImplicit === null ? null : "defectiune");

  /*
   * ── PIERDEREA DE DATE PE CARE O OPREȘTE ────────────────────────────────────
   * „Schimbă tipul" făcea `setTip(null)`. Formularul se demonta cu totul, iar
   * câmpurile fiind NECONTROLATE, tot ce era tastat dispărea odată cu DOM-ul:
   * titlul, cele patru câmpuri de bug (până la 4000 de caractere fiecare) și
   * descrierea (până la 8000). Fără avertisment, fără confirmare, dintr-un link
   * de 12px — iar „titlu" și „descriere" sunt comune TUTUROR tipurilor, deci
   * nici măcar nu aveau de ce să se piardă.
   *
   * Aici valorile se fotografiază înainte de demontare și se pun înapoi ca
   * `defaultValue` la remontare. Un utilizator care se răzgândește de două ori
   * își regăsește și câmpurile specifice primului tip: cheile sunt numele
   * câmpurilor, iar ele nu se ciocnesc între tipuri.
   *
   * A doua pierdere, găsită de QA pe ambele rute (ANG-022, MGR-014): un refuz
   * de validare golea formularul, fiindcă React 19 îl resetează după
   * `<form action>`. O oprește `<Formular>`, cu `valoriTrimise`. Cele două
   * mecanisme se înlănțuie: fotografia e sursa până la prima trimitere, apoi
   * `valoriTrimise` — iar fotografia următoare se face din DOM-ul deja
   * restaurat, deci nu se pierde nimic nici la „Schimbă tipul" de după refuz.
   */
  const [pastrate, setPastrate] = useState<Readonly<Record<string, string>>>({});
  const pastrat = (nume: string, implicit = ""): string => pastrate[nume] ?? implicit;

  const schimbaTipul = (e: MouseEvent<HTMLButtonElement>) => {
    const formular = e.currentTarget.form;
    if (formular !== null) {
      const fotografie: Record<string, string> = {};
      for (const [cheie, valoare] of new FormData(formular).entries()) {
        if (typeof valoare === "string") fotografie[cheie] = valoare;
      }
      // Bifa NU apare în `FormData` când e nebifată. Fără rândul ăsta, cine
      // bifează, se răzgândește și apoi schimbă tipul ar regăsi bifa pusă la
      // loc — adică exact ce a debifat, restaurat tăcut.
      const bifa = formular.elements.namedItem("blocheaza");
      if (bifa instanceof HTMLInputElement) fotografie["blocheaza"] = bifa.checked ? "on" : "";
      setPastrate((vechi) => ({ ...vechi, ...fotografie }));
    }
    setTip(null);
  };

  const laReusita = useCallback(
    (tichet: TichetCreat) => {
      router.push(`${prefixCale}/${tichet.id}`);
    },
    [router, prefixCale],
  );

  if (tip === null) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-corp">Ce fel de solicitare deschideți?</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {TIPURI_TICHET.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTip(t)}
              className="border-border hover:border-primary hover:bg-surface rounded-panou border p-4 text-left"
            >
              <span className="text-foreground block font-medium">{ETICHETE_TIP[t]}</span>
              <span className="text-muted-foreground text-corp mt-1 block">{DESCRIERI_TIP[t]}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const trimite = async (fd: FormData): Promise<ActionResult<TichetCreat>> => {
    // Contextul de diagnostic se citește din browser, nu din formular:
    // angajatul nu trebuie să știe ce e un user agent.
    const context =
      tip === "bug_erp"
        ? {
            url: window.location.href,
            user_agent: navigator.userAgent,
            versiune: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
          }
        : undefined;

    const brut: Record<string, unknown> = { tip };
    for (const [cheie, valoare] of fd.entries()) {
      if (typeof valoare === "string") brut[cheie] = valoare;
    }
    if (tip === "defectiune") brut["blocheaza_activitatea"] = fd.get("blocheaza") === "on";
    if (context !== undefined) brut["context"] = context;

    return creeazaTichet(brut);
  };

  return (
    <Formular actiune={trimite} laReusita={laReusita}>
      {(stare) => {
        // Până la prima trimitere, sursa e fotografia de la „Schimbă tipul";
        // după, ce s-a trimis ultima dată.
        const trimis = Object.keys(stare.valoriTrimise).length > 0;
        const v = (nume: string, implicit = ""): string =>
          trimis ? (stare.valoriTrimise[nume] ?? "") : pastrat(nume, implicit);
        const erori = (nume: string): readonly string[] => stare.erori[nume] ?? [];

        return (
          <>
            <div className="flex items-center justify-between gap-4">
              <p className="text-foreground text-corp font-medium">{ETICHETE_TIP[tip]}</p>
              <Buton varianta="link" onClick={schimbaTipul}>
                Schimbă tipul
              </Buton>
            </div>

            <Camp nume="titlu" eticheta="Titlu" obligatoriu erori={erori("titlu")}>
              {(a) => <input {...a} defaultValue={v("titlu")} maxLength={200} />}
            </Camp>

            {tip === "software" && (
              <>
                <Camp
                  nume="aplicatie"
                  eticheta="Ce aplicație"
                  obligatoriu
                  erori={erori("aplicatie")}
                >
                  {(a) => (
                    <input {...a} defaultValue={v("aplicatie")} placeholder="Adobe Photoshop" />
                  )}
                </Camp>
                <Camp
                  nume="numar_licente"
                  eticheta="Număr de licențe"
                  obligatoriu
                  erori={erori("numar_licente")}
                >
                  {(a) => (
                    <input {...a} type="number" min={1} defaultValue={v("numar_licente", "1")} />
                  )}
                </Camp>
                <Camp
                  nume="motiv_necesitate"
                  eticheta="De ce vă este necesară"
                  fel="textarea"
                  erori={erori("motiv_necesitate")}
                >
                  {(a) => <textarea {...a} defaultValue={v("motiv_necesitate")} rows={2} />}
                </Camp>
              </>
            )}

            {tip === "hardware" && (
              <>
                <Camp
                  nume="denumire_hardware"
                  eticheta="Ce echipament"
                  obligatoriu
                  erori={erori("denumire_hardware")}
                >
                  {(a) => (
                    <input
                      {...a}
                      defaultValue={v("denumire_hardware")}
                      placeholder="Monitor 27 inch"
                    />
                  )}
                </Camp>
                <Camp
                  nume="loc_livrare"
                  eticheta="Unde se livrează"
                  fel="select"
                  obligatoriu
                  erori={erori("loc_livrare")}
                >
                  {(a) => (
                    <select {...a} defaultValue={v("loc_livrare", "birou")}>
                      <option value="birou">La birou</option>
                      <option value="domiciliu">La domiciliu</option>
                    </select>
                  )}
                </Camp>
                <Camp
                  nume="adresa_livrare"
                  eticheta="Adresa de livrare"
                  ajutor="Obligatorie doar dacă echipamentul se livrează la domiciliu."
                  erori={erori("adresa_livrare")}
                >
                  {(a) => <input {...a} defaultValue={v("adresa_livrare")} />}
                </Camp>
              </>
            )}

            {tip === "defectiune" && (
              <>
                {obiecteAlocate.length === 0 ? (
                  <div className="flex flex-col">
                    <p className="text-foreground text-corp mb-1 block font-medium">
                      Ce s-a stricat
                    </p>
                    <p className="border-border text-muted-foreground rounded-control text-corp border border-dashed p-3">
                      Nu aveți niciun obiect de inventar în primire. Dacă ceva v-a fost dat și nu
                      apare aici, cereți-i administratorului să-l înregistreze în inventar întâi.
                    </p>
                    {erori("inventory_item_id").length === 0 ? null : (
                      <p role="alert" className="text-danger text-nota mt-1">
                        {erori("inventory_item_id").join(" ")}
                      </p>
                    )}
                  </div>
                ) : (
                  <Camp
                    nume="inventory_item_id"
                    eticheta="Ce s-a stricat"
                    fel="select"
                    obligatoriu
                    erori={erori("inventory_item_id")}
                  >
                    {(a) => (
                      <select {...a} defaultValue={v("inventory_item_id", obiectImplicit ?? "")}>
                        <option value="">— Alege —</option>
                        {obiecteAlocate.map((obiect) => (
                          <option key={obiect.id} value={obiect.id}>
                            {obiect.denumire}
                            {obiect.numar_inventar === null ? "" : ` · ${obiect.numar_inventar}`}
                            {obiect.serie === null ? "" : ` · seria ${obiect.serie}`}
                          </option>
                        ))}
                      </select>
                    )}
                  </Camp>
                )}
                {/* Bifa rămâne scrisă de mână: `Camp` pune eticheta ÎNAINTEA
                    controlului, iar la o casetă de bifat eticheta stă după. */}
                <div className="flex items-center gap-2">
                  <input
                    id={`${id}-blocheaza`}
                    name="blocheaza"
                    type="checkbox"
                    defaultChecked={
                      (trimis ? stare.valoriTrimise["blocheaza"] : pastrat("blocheaza")) === "on"
                    }
                    className={clasaBifa}
                  />
                  <label htmlFor={`${id}-blocheaza`} className="text-foreground text-corp">
                    Nu îmi pot face treaba din cauza asta
                  </label>
                </div>
                <Camp nume="locatie" eticheta="Unde se află echipamentul" erori={erori("locatie")}>
                  {(a) => (
                    <input {...a} defaultValue={v("locatie")} placeholder="Etaj 2, birou 12" />
                  )}
                </Camp>
              </>
            )}

            {tip === "bug_erp" && (
              <>
                <Camp nume="modul" eticheta="Unde s-a întâmplat" obligatoriu erori={erori("modul")}>
                  {(a) => <input {...a} defaultValue={v("modul", modulCurent)} />}
                </Camp>
                <Camp
                  nume="pasi_efectuati"
                  eticheta="Ce ați făcut"
                  fel="textarea"
                  obligatoriu
                  erori={erori("pasi_efectuati")}
                >
                  {(a) => <textarea {...a} defaultValue={v("pasi_efectuati")} rows={3} />}
                </Camp>
                <Camp
                  nume="rezultat_asteptat"
                  eticheta="Ce te așteptai să se întâmple"
                  fel="textarea"
                  obligatoriu
                  erori={erori("rezultat_asteptat")}
                >
                  {(a) => <textarea {...a} defaultValue={v("rezultat_asteptat")} rows={2} />}
                </Camp>
                <Camp
                  nume="rezultat_obtinut"
                  eticheta="Ce s-a întâmplat de fapt"
                  fel="textarea"
                  obligatoriu
                  erori={erori("rezultat_obtinut")}
                >
                  {(a) => <textarea {...a} defaultValue={v("rezultat_obtinut")} rows={2} />}
                </Camp>
              </>
            )}

            <Camp
              nume="descriere"
              eticheta="Detalii"
              fel="textarea"
              obligatoriu
              erori={erori("descriere")}
            >
              {(a) => <textarea {...a} defaultValue={v("descriere")} rows={4} />}
            </Camp>

            <div>
              <Buton type="submit" varianta="primar" inCurs={stare.inCurs} textInCurs="Se trimite…">
                Trimite tichetul
              </Buton>
            </div>
          </>
        );
      }}
    </Formular>
  );
}
