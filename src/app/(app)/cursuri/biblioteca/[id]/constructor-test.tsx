"use client";

// src/app/(app)/cursuri/biblioteca/[id]/constructor-test.tsx
//
// Testul se scrie pe VERSIUNE, nu pe material: dovada de parcurgere ancorează
// versiunea, deci întrebările la care a răspuns cineva anul trecut trebuie să
// rămână cele de atunci. O versiune nouă înseamnă un test nou.
//
// Răspunsul corect se alege aici și pleacă separat, către `course_answer_keys`.
// Nu ajunge niciodată în coloana `intrebari`, care e citibilă de angajat.

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { clasaBifa, clasaControl } from "@/components/ui/camp";
import { StareGoala } from "@/components/ui/stare-goala";
import { arataToast } from "@/components/ui/toast";
import { ListChecks } from "lucide-react";

import { salveazaTest } from "../../actions";

interface OptiuneLocala {
  readonly id: string;
  readonly text: string;
}
interface IntrebareLocala {
  readonly id: string;
  readonly text: string;
  readonly optiuni: readonly OptiuneLocala[];
  readonly corect: string;
}

interface Proprietati {
  readonly versiuneId: string;
  readonly pragTest: number;
  readonly initiale: readonly IntrebareLocala[];
}

/** Identificatori stabili și scurți: intră în cheia de răspuns și în jsonb. */
function idNou(prefix: string, existente: readonly { id: string }[]): string {
  let n = existente.length + 1;
  const luate = new Set(existente.map((e) => e.id));
  while (luate.has(`${prefix}${String(n)}`)) n += 1;
  return `${prefix}${String(n)}`;
}

export function ConstructorTest({ versiuneId, pragTest, initiale }: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [intrebari, setIntrebari] = useState<readonly IntrebareLocala[]>(initiale);
  const [eroare, setEroare] = useState<string | null>(null);

  const modifica = useCallback(
    (index: number, schimbare: (i: IntrebareLocala) => IntrebareLocala): void => {
      setIntrebari((precedente) =>
        precedente.map((intrebare, i) => (i === index ? schimbare(intrebare) : intrebare)),
      );
    },
    [],
  );

  const salveaza = useCallback((): void => {
    setEroare(null);
    porneste(async () => {
      const rezultat = await salveazaTest({ version_id: versiuneId, intrebari });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      arataToast({
        fel: "reusita",
        text: `Testul a fost salvat: ${String(rezultat.data.intrebari)} întrebări.`,
      });
      router.refresh();
    });
  }, [intrebari, router, versiuneId]);

  return (
    <div className="space-y-4">
      <Callout fel="informativ" titlu="Cum se trece testul">
        Angajatul trebuie să obțină cel puțin {pragTest.toFixed(0)} din 100. Nota o
        calculează baza, din răspunsurile corecte alese aici — ele nu ajung
        niciodată în browserul lui. Reîncercările sunt nelimitate și se
        păstrează toate.
      </Callout>

      {intrebari.length === 0 ? (
        <StareGoala
          fel="initiala"
          compact
          pictograma={ListChecks}
          titlu="Testul nu are întrebări"
          descriere="Adăugați prima întrebare. Fiecare are cel puțin două variante și exact un răspuns corect."
        />
      ) : (
        <ol className="space-y-3">
          {intrebari.map((intrebare, index) => (
            <li key={intrebare.id} className="border-border rounded-panou space-y-3 border p-4">
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground text-nota mt-2 tabular-nums">
                  {index + 1}.
                </span>
                <label className="flex-1">
                  <span className="sr-only">Textul întrebării {index + 1}</span>
                  <input
                    type="text"
                    value={intrebare.text}
                    maxLength={500}
                    placeholder="Scrieți întrebarea"
                    className={clasaControl()}
                    onChange={(e) => {
                      modifica(index, (i) => ({ ...i, text: e.target.value }));
                    }}
                  />
                </label>
                <Buton
                  varianta="tertiar"
                  marime="iconita"
                  aria-label={`Șterge întrebarea ${index + 1}`}
                  onClick={() => {
                    setIntrebari((p) => p.filter((_, i) => i !== index));
                  }}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Buton>
              </div>

              <fieldset className="space-y-1 ps-6">
                <legend className="text-eticheta text-muted-foreground uppercase">
                  Variante — bifați răspunsul corect
                </legend>
                {intrebare.optiuni.map((optiune, io) => (
                  <div key={optiune.id} className="flex min-h-11 items-center gap-2">
                    <input
                      type="radio"
                      name={`corect-${intrebare.id}`}
                      className={clasaBifa}
                      checked={intrebare.corect === optiune.id}
                      aria-label={`Varianta ${String(io + 1)} e corectă`}
                      onChange={() => {
                        modifica(index, (i) => ({ ...i, corect: optiune.id }));
                      }}
                    />
                    <input
                      type="text"
                      value={optiune.text}
                      maxLength={300}
                      placeholder={`Varianta ${String(io + 1)}`}
                      className={clasaControl()}
                      onChange={(e) => {
                        modifica(index, (i) => ({
                          ...i,
                          optiuni: i.optiuni.map((o, k) =>
                            k === io ? { ...o, text: e.target.value } : o,
                          ),
                        }));
                      }}
                    />
                    <Buton
                      varianta="tertiar"
                      marime="iconita"
                      aria-label={`Șterge varianta ${String(io + 1)}`}
                      disabled={intrebare.optiuni.length <= 2}
                      onClick={() => {
                        modifica(index, (i) => ({
                          ...i,
                          optiuni: i.optiuni.filter((_, k) => k !== io),
                          // Dacă tocmai s-a șters varianta corectă, alegerea se
                          // golește: altfel cheia ar arăta spre o variantă care
                          // nu mai există, iar baza ar refuza salvarea cu un
                          // mesaj greu de legat de gestul făcut.
                          corect: i.corect === optiune.id ? "" : i.corect,
                        }));
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Buton>
                  </div>
                ))}
                <Buton
                  varianta="tertiar"
                  disabled={intrebare.optiuni.length >= 8}
                  onClick={() => {
                    modifica(index, (i) => ({
                      ...i,
                      optiuni: [...i.optiuni, { id: idNou("o", i.optiuni), text: "" }],
                    }));
                  }}
                >
                  Încă o variantă
                </Buton>
              </fieldset>
            </li>
          ))}
        </ol>
      )}

      {eroare === null ? null : (
        <Callout fel="eroare" titlu="Testul nu s-a putut salva">
          {eroare}
        </Callout>
      )}

      <BaraActiuni eticheta="Editarea testului">
        <Buton
          varianta="secundar"
          disabled={intrebari.length >= 50}
          onClick={() => {
            setIntrebari((p) => [
              ...p,
              {
                id: idNou("q", p),
                text: "",
                optiuni: [
                  { id: "o1", text: "" },
                  { id: "o2", text: "" },
                ],
                corect: "",
              },
            ]);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          Întrebare nouă
        </Buton>
        <Buton
          varianta="primar"
          disabled={intrebari.length === 0 || inCurs}
          inCurs={inCurs}
          textInCurs="Se salvează…"
          onClick={salveaza}
        >
          Salvează testul
        </Buton>
      </BaraActiuni>
    </div>
  );
}
