// src/app/(app)/salarizare/componente/formular-sablon-componenta-nou.tsx
"use client";

import { Plus } from "lucide-react";

import { Camp, clasaBifa } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
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

/**
 * Șablon de componentă salarială, într-o casetă.
 *
 * Formularul se desfăcea sub antet și împingea în jos lista șabloanelor deja
 * definite — exact lista din care se vede ce cod intern e liber și ce regim
 * fiscal au surorile componentei pe care o adaugi.
 */
export function FormularSablonComponentaNou() {
  return (
    <FormularDialog
      declansator={{
        eticheta: "Șablon nou",
        pictograma: <Plus aria-hidden="true" className="size-4" />,
      }}
      titlu="Șablon de componentă salarială"
      descriere="Regimul fiscal ales aici se aplică fiecărui angajat căruia i se asociază componenta. Se poate schimba ulterior, dar nu retroactiv: fluturașii deja calculați rămân cum au fost."
      marime="mare"
      actiune={trimite}
      mesajReusita="Șablonul a fost creat."
      etichetaTrimite="Creează șablonul"
      textInCurs="Se creează…"
    >
      {(stare, idc) => {
        // Echivalentul lui `valoriTrimise[cheie] ?? valoarea inițială`, pentru
        // bife: după o trimitere respinsă contează dacă cheia a AJUNS în
        // `FormData`, fiindcă o casetă nebifată nu apare deloc acolo. Înainte
        // de prima trimitere, harta e goală și rămâne valoarea inițială.
        const bifa = (cheie: string, initial: boolean): boolean =>
          Object.keys(stare.valoriTrimise).length === 0
            ? initial
            : stare.valoriTrimise[cheie] === "on";

        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <Camp
              nume="cod"
              id={idc("cod")}
              eticheta="Cod intern"
              obligatoriu
              erori={stare.erori["cod"] ?? []}
            >
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
              id={idc("denumire")}
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
              id={idc("kind")}
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
              id={idc("cod_revisal")}
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
                  id={idc("impozabil")}
                  name="impozabil"
                  type="checkbox"
                  defaultChecked={bifa("impozabil", true)}
                  className={clasaBifa}
                />
                <label htmlFor={idc("impozabil")} className="text-corp">
                  Impozabil
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id={idc("cas")}
                  name="intra_in_baza_cas"
                  type="checkbox"
                  defaultChecked={bifa("intra_in_baza_cas", true)}
                  className={clasaBifa}
                />
                <label htmlFor={idc("cas")} className="text-corp">
                  Intră în baza CAS
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id={idc("cass")}
                  name="intra_in_baza_cass"
                  type="checkbox"
                  defaultChecked={bifa("intra_in_baza_cass", true)}
                  className={clasaBifa}
                />
                <label htmlFor={idc("cass")} className="text-corp">
                  Intră în baza CASS
                </label>
              </div>
            </fieldset>
          </div>
        );
      }}
    </FormularDialog>
  );
}
