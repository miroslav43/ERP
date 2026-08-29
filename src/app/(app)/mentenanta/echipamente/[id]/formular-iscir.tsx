"use client";

import { Plus } from "lucide-react";
import { useCallback } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { adaugaAutorizatieIscir } from "../../actions";

/**
 * Autorizația ISCIR nouă, pe `<Formular>` + `<Camp>`.
 *
 * ── CE S-A REPARAT ────────────────────────────────────────────────────────
 * Formularul avea `<form action={trimite}>` cu câmpuri necontrolate. React 19
 * RESETEAZĂ un asemenea formular după ce acțiunea se încheie, deci o eroare de
 * validare — un `valabil_pana` scris greșit — golea și numărul, și tipul, și
 * condițiile. Omul reintroducea tot ca să afle a doua oară același lucru.
 * `<Formular>` ține starea în `useActionState` și dă valorile înapoi prin
 * `valoriTrimise`.
 *
 * În plus, `adaugaAutorizatieIscir` întoarce `fieldErrors` pe fiecare cheie a
 * lui `autorizatieIscirNouaSchema`, iar fișierul le arunca: afișa doar
 * `error.message` lângă buton. Acum fiecare mesaj stă lângă câmpul lui, legat
 * prin `aria-describedby`.
 *
 * ── DE CE `id` EXPLICIT PE FIECARE CÂMP ───────────────────────────────────
 * Fișa echipamentului randa CINCI formulare simultan, iar `tip` apărea în patru
 * dintre ele. `Camp` derivă identificatorul din `nume`, deci fără un prefix
 * propriu al formularului patru etichete ar fi arătat spre același control.
 * Acum cele cinci sunt casete, deci nu mai coexistă pe ecran — dar prefixul
 * rămâne, fiindcă două casete pot fi deschise una după alta fără reîncărcare,
 * iar `idc` îl dă gratuit.
 */
export function FormularIscir({ equipmentId }: { readonly equipmentId: string }) {
  const trimite = useCallback(
    async (formular: FormData) => {
      const gol = (cheie: string): string | null => {
        const v = String(formular.get(cheie) ?? "").trim();
        return v.length === 0 ? null : v;
      };

      return await adaugaAutorizatieIscir({
        equipment_id: equipmentId,
        numar: String(formular.get("numar") ?? ""),
        tip: String(formular.get("tip") ?? ""),
        emitent: gol("emitent") ?? "ISCIR",
        emis_la: gol("emis_la"),
        valabil_pana: String(formular.get("valabil_pana") ?? ""),
        scadenta_verificare_tehnica: gol("scadenta_verificare_tehnica"),
        conditii: gol("conditii"),
      });
    },
    [equipmentId],
  );

  return (
    <FormularDialog
      declansator={{
        eticheta: "Autorizație ISCIR nouă",
        varianta: "secundar",
        pictograma: <Plus aria-hidden="true" className="size-4" />,
      }}
      titlu="Autorizație ISCIR nouă"
      descriere="Data de expirare intră în lista de scadențe a modulului de conformitate. Un echipament cu autorizația expirată nu are voie să funcționeze."
      marime="mare"
      actiune={trimite}
      mesajReusita="Autorizația ISCIR a fost salvată."
      etichetaTrimite="Salvează autorizația"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => {
        // Formularul rămâne pe ecran după salvare, deci trebuie să
        // repornească gol: React 19 resetează un `<form action>` necontrolat
        // după acțiune, iar resetul pune înapoi `defaultValue` — adică exact
        // ce tocmai s-a salvat. `valoriTrimise` se păstrează DOAR cât timp
        // ultimul răspuns a fost un refuz.
        const trimise: Readonly<Record<string, string>> =
          stare.data === null ? stare.valoriTrimise : {};

        return (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Camp
                nume="numar"
                id={idc("numar")}
                eticheta="Număr"
                obligatoriu
                erori={stare.erori["numar"] ?? []}
              >
                {(a) => <input {...a} maxLength={80} defaultValue={trimise["numar"] ?? ""} />}
              </Camp>

              <Camp
                nume="tip"
                id={idc("tip")}
                eticheta="Tip"
                obligatoriu
                erori={stare.erori["tip"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    maxLength={80}
                    placeholder="Ex. macara, stivuitor, cazan"
                    defaultValue={trimise["tip"] ?? ""}
                  />
                )}
              </Camp>

              <Camp
                nume="emitent"
                id={idc("emitent")}
                eticheta="Emitent"
                erori={stare.erori["emitent"] ?? []}
              >
                {(a) => (
                  <input {...a} maxLength={120} defaultValue={trimise["emitent"] ?? "ISCIR"} />
                )}
              </Camp>

              <Camp
                nume="emis_la"
                id={idc("emis-la")}
                eticheta="Emisă la"
                erori={stare.erori["emis_la"] ?? []}
              >
                {(a) => <input {...a} type="date" defaultValue={trimise["emis_la"] ?? ""} />}
              </Camp>

              <Camp
                nume="valabil_pana"
                id={idc("valabil-pana")}
                eticheta="Valabilă până la"
                obligatoriu
                erori={stare.erori["valabil_pana"] ?? []}
              >
                {(a) => <input {...a} type="date" defaultValue={trimise["valabil_pana"] ?? ""} />}
              </Camp>

              <Camp
                nume="scadenta_verificare_tehnica"
                id={idc("scadenta-verificare")}
                eticheta="Scadența verificării tehnice"
                erori={stare.erori["scadenta_verificare_tehnica"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="date"
                    defaultValue={trimise["scadenta_verificare_tehnica"] ?? ""}
                  />
                )}
              </Camp>

              <Camp
                nume="conditii"
                id={idc("conditii")}
                eticheta="Condiții"
                fel="textarea"
                className="sm:col-span-2 lg:col-span-3"
                erori={stare.erori["conditii"] ?? []}
              >
                {(a) => (
                  <textarea
                    {...a}
                    rows={2}
                    maxLength={1000}
                    defaultValue={trimise["conditii"] ?? ""}
                  />
                )}
              </Camp>
            </div>
          </>
        );
      }}
    </FormularDialog>
  );
}
