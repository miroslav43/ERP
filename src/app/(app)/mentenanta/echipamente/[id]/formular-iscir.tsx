"use client";

import { useCallback, useId } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
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
 * Fișa echipamentului randează cinci formulare simultan, iar `tip` apare în
 * patru dintre ele. `Camp` derivă identificatorul din `nume`, deci fără un
 * prefix propriu al formularului patru etichete ar arăta spre același control.
 */
export function FormularIscir({ equipmentId }: { readonly equipmentId: string }) {
  const router = useRouter();
  const idFormular = useId();
  const idc = (sufix: string): string => `${idFormular}-${sufix}`;

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

  // `laReusita` intră în lista de dependențe a unui `useEffect` din `<Formular>`.
  // O funcție creată la fiecare randare ar reporni efectul la fiecare randare,
  // deci ar reîmprospăta ruta la nesfârșit.
  const reimprospateaza = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <section
      aria-labelledby={idc("titlu")}
      className="border-border rounded-panou space-y-3 border p-4"
    >
      <h3 id={idc("titlu")} className="text-corp font-medium">
        Autorizație ISCIR nouă
      </h3>

      <Formular
        actiune={trimite}
        laReusita={reimprospateaza}
        mesajReusita="Autorizația ISCIR a fost salvată."
      >
        {(stare) => {
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

              <div>
                <Buton
                  type="submit"
                  varianta="primar"
                  inCurs={stare.inCurs}
                  textInCurs="Se salvează…"
                >
                  Salvează autorizația
                </Buton>
              </div>
            </>
          );
        }}
      </Formular>
    </section>
  );
}
