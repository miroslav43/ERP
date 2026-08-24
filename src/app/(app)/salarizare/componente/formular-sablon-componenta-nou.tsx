// src/app/(app)/salarizare/componente/formular-sablon-componenta-nou.tsx
"use client";

import { useCallback, useId, useState } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import { TIPURI_COMPONENTA_SALARIALA } from "@/schemas/salary-component";

import { creeazaSablonComponenta } from "./actions";

const ETICHETE_TIP: Record<(typeof TIPURI_COMPONENTA_SALARIALA)[number], string> = {
  spor_procent: "Spor procentual (% din salariul de bază)",
  spor_suma: "Spor — sumă fixă lunară",
  indemnizatie: "Indemnizație",
  prima_recurenta: "Primă recurentă",
  beneficiu_natura: "Beneficiu în natură",
};

/**
 * Numele câmpurilor sunt EXACT cheile lui `creeazaSablonComponentaSchema`:
 * `cod`, `denumire`, `kind`, `impozabil`, `intra_in_baza_cas`,
 * `intra_in_baza_cass`, `cod_revisal`. Pe ele se potrivește harta `fieldErrors`
 * construită de `create-action.ts`; un nume greșit cu o literă face ca mesajul
 * serverului să nu mai găsească niciun câmp și să dispară fără urmă.
 *
 * Bifele se citesc explicit ca `=== "on"`, nu se lasă pe seama lui
 * `z.coerce.boolean()`: o casetă nebifată LIPSEȘTE din `FormData`, iar
 * `.default(true)` din schemă ar readuce-o tăcut pe „bifat”.
 */
async function trimite(fd: FormData) {
  return creeazaSablonComponenta({
    cod: String(fd.get("cod") ?? ""),
    denumire: String(fd.get("denumire") ?? ""),
    kind: String(fd.get("kind") ?? "spor_procent"),
    impozabil: fd.get("impozabil") === "on",
    intra_in_baza_cas: fd.get("intra_in_baza_cas") === "on",
    intra_in_baza_cass: fd.get("intra_in_baza_cass") === "on",
    cod_revisal: String(fd.get("cod_revisal") ?? ""),
  });
}

export function FormularSablonComponentaNou() {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const idBifa = useId();

  // `laReusita` intră în dependențele efectului de succes din `Formular`. O
  // funcție nouă la fiecare randare ar reporni efectul după `router.refresh()`,
  // iar notificarea ar apărea de două ori pentru o singură salvare.
  const laReusita = useCallback(() => {
    setDeschis(false);
    router.refresh();
  }, [router]);

  if (!deschis) {
    return (
      <Buton
        varianta="primar"
        onClick={() => {
          setDeschis(true);
        }}
      >
        Șablon nou
      </Buton>
    );
  }

  return (
    <Formular
      actiune={trimite}
      laReusita={laReusita}
      mesajReusita="Șablonul a fost creat."
      className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-2"
    >
      {(stare) => {
        // Echivalentul lui `valoriTrimise[cheie] ?? valoarea inițială`, pentru
        // bife: după o trimitere respinsă contează dacă cheia a AJUNS în
        // `FormData`, fiindcă o casetă nebifată nu apare deloc acolo. Înainte
        // de prima trimitere, harta e goală și rămâne valoarea inițială.
        const bifa = (cheie: string, initial: boolean): boolean =>
          Object.keys(stare.valoriTrimise).length === 0
            ? initial
            : stare.valoriTrimise[cheie] === "on";

        return (
          <>
            <Camp nume="cod" eticheta="Cod intern" obligatoriu erori={stare.erori["cod"] ?? []}>
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={40}
                  placeholder="spor_vechime"
                  defaultValue={stare.valoriTrimise["cod"] ?? ""}
                />
              )}
            </Camp>

            <Camp
              nume="denumire"
              eticheta="Denumire"
              obligatoriu
              erori={stare.erori["denumire"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={160}
                  defaultValue={stare.valoriTrimise["denumire"] ?? ""}
                />
              )}
            </Camp>

            <Camp
              nume="kind"
              eticheta="Tip"
              fel="select"
              obligatoriu
              erori={stare.erori["kind"] ?? []}
              className="sm:col-span-2"
            >
              {(a) => (
                <select {...a} defaultValue={stare.valoriTrimise["kind"] ?? "spor_procent"}>
                  {TIPURI_COMPONENTA_SALARIALA.map((tip) => (
                    <option key={tip} value={tip}>
                      {ETICHETE_TIP[tip]}
                    </option>
                  ))}
                </select>
              )}
            </Camp>

            <Camp
              nume="cod_revisal"
              eticheta="Cod REVISAL"
              erori={stare.erori["cod_revisal"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={40}
                  defaultValue={stare.valoriTrimise["cod_revisal"] ?? ""}
                />
              )}
            </Camp>

            {/*
              Bifele rămân scrise de mână: `Camp` pune eticheta ÎNAINTEA
              controlului, iar la o casetă de bifat eticheta stă DUPĂ ea.
              Clasele vin din `clasaBifa`, ca să nu reapară a cincea variantă de
              chenar. Niciuna dintre cele trei nu poate primi eroare de câmp
              separat — un boolean trece sau nu prin `z.coerce.boolean()` — deci
              nu pierd nimic prin faptul că nu trec prin `Camp`.
            */}
            <fieldset className="flex flex-col gap-2 sm:col-span-2">
              <legend className="text-foreground text-corp mb-1 font-medium">
                Regimul fiscal al componentei
              </legend>
              <div className="flex items-center gap-2">
                <input
                  id={`${idBifa}-impozabil`}
                  name="impozabil"
                  type="checkbox"
                  defaultChecked={bifa("impozabil", true)}
                  className={clasaBifa}
                />
                <label htmlFor={`${idBifa}-impozabil`} className="text-corp">
                  Impozabil
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id={`${idBifa}-cas`}
                  name="intra_in_baza_cas"
                  type="checkbox"
                  defaultChecked={bifa("intra_in_baza_cas", true)}
                  className={clasaBifa}
                />
                <label htmlFor={`${idBifa}-cas`} className="text-corp">
                  Intră în baza CAS
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id={`${idBifa}-cass`}
                  name="intra_in_baza_cass"
                  type="checkbox"
                  defaultChecked={bifa("intra_in_baza_cass", true)}
                  className={clasaBifa}
                />
                <label htmlFor={`${idBifa}-cass`} className="text-corp">
                  Intră în baza CASS
                </label>
              </div>
            </fieldset>

            <div className="flex items-center gap-3 sm:col-span-2">
              <Buton type="submit" varianta="primar" inCurs={stare.inCurs} textInCurs="Se creează…">
                Creează șablonul
              </Buton>
              <Buton
                varianta="link"
                onClick={() => {
                  setDeschis(false);
                }}
              >
                Renunță
              </Buton>
            </div>
          </>
        );
      }}
    </Formular>
  );
}
