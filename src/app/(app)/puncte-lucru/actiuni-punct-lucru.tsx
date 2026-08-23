// src/app/(app)/puncte-lucru/actiuni-punct-lucru.tsx
"use client";

import { useCallback, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Pencil } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import { JUDETE } from "@/schemas/organization";
import { actualizeazaPunctLucru, dezactiveazaPunctLucru } from "./actions";

/**
 * Acțiunile unui rând din lista punctelor de lucru: editarea și dezactivarea.
 *
 * Sunt DOUĂ lucruri separate, deci rămân separate. Numai editarea trece prin
 * `<Formular>`: ea are câmpuri, deci și `fieldErrors` de arătat pe câmp, și
 * date de pierdut la resetul de după acțiune al lui React 19. Dezactivarea
 * n-are decât `id`, luat din props — acolo `useTransition` și un mesaj sub
 * butoane spun tot ce e de spus.
 *
 * Identificatorii se prefixează cu `useId()`: componenta se randează o dată per
 * rând, mai multe rânduri pot fi deschise în același timp, iar `Camp` derivă
 * `id` din `nume` — `denumire`, `judet` și `oras` s-ar repeta pe pagină.
 */

interface Proprietati {
  readonly punct: Readonly<{
    id: string;
    denumire: string;
    adresa: string | null;
    judet: string | null;
    oras: string | null;
    cod_postal: string | null;
    sediu_principal: boolean;
    observatii: string | null;
  }>;
  readonly poateEdita: boolean;
}

export function ActiuniPunctLucru({ punct, poateEdita }: Proprietati) {
  const router = useRouter();
  const [editeaza, setEditeaza] = useState(false);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idFormular = useId();
  const idc = (sufix: string): string => `${idFormular}-${sufix}`;

  // `useCallback`: `laReusita` intră în dependențele efectului din `Formular`;
  // o funcție nouă la fiecare randare ar scoate notificarea de două ori.
  const laReusita = useCallback((): void => {
    setEditeaza(false);
    router.refresh();
  }, [router]);

  if (!poateEdita) return null;

  /** Cheile obiectului sunt EXACT cele din `actualizeazaPunctLucruSchema`. */
  async function trimiteEditare(date: FormData) {
    // `judetSchema.nullable()` nu cunoaște șirul gol: „— Alegeți —” devine
    // `null` aici, nu în schemă.
    const judet = String(date.get("judet") ?? "");
    return actualizeazaPunctLucru({
      id: punct.id,
      denumire: String(date.get("denumire") ?? ""),
      adresa: String(date.get("adresa") ?? ""),
      judet: judet === "" ? null : judet,
      oras: String(date.get("oras") ?? ""),
      cod_postal: String(date.get("cod_postal") ?? ""),
      sediu_principal: date.get("sediu_principal") === "on",
      // Observațiile n-au câmp în acest formular; se duc înapoi neschimbate.
      observatii: punct.observatii,
    });
  }

  function dezactiveaza(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await dezactiveazaPunctLucru({ id: punct.id });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="text-nota flex flex-wrap gap-1">
        <Buton
          varianta="tertiar"
          onClick={() => {
            setEditeaza((v) => !v);
          }}
        >
          <Pencil aria-hidden="true" className="size-3.5" />
          Editează
        </Buton>
        <Buton varianta="distructiv" onClick={dezactiveaza} disabled={inCurs}>
          <Ban aria-hidden="true" className="size-3.5" />
          Dezactivează
        </Buton>
      </div>

      {eroare === null ? null : (
        <p role="alert" className="text-danger text-nota">
          {eroare}
        </p>
      )}

      {editeaza ? (
        <Formular
          actiune={trimiteEditare}
          laReusita={laReusita}
          mesajReusita="Punctul de lucru a fost salvat."
          className="border-border rounded-control grid gap-2 border p-3 sm:grid-cols-2"
        >
          {(stare) => {
            // Într-un `FormData` o bifă NEBIFATĂ lipsește cu totul, deci „încă
            // nu s-a trimis nimic” și „s-a trimis nebifat” arată identic pe
            // cheia ei. Se disting uitându-ne dacă formularul a plecat măcar o
            // dată — altfel o bifă scoasă de om s-ar pune la loc la prima
            // eroare de validare.
            const sTrimis = Object.keys(stare.valoriTrimise).length > 0;
            const sediuPrincipal = sTrimis
              ? stare.valoriTrimise["sediu_principal"] === "on"
              : punct.sediu_principal;

            return (
              <>
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
                      defaultValue={stare.valoriTrimise["denumire"] ?? punct.denumire}
                    />
                  )}
                </Camp>

                <Camp
                  nume="judet"
                  id={idc("judet")}
                  eticheta="Județ"
                  fel="select"
                  erori={stare.erori["judet"] ?? []}
                >
                  {(a) => (
                    <select {...a} defaultValue={stare.valoriTrimise["judet"] ?? punct.judet ?? ""}>
                      <option value="">— Alegeți —</option>
                      {JUDETE.map((judet) => (
                        <option key={judet} value={judet}>
                          {judet}
                        </option>
                      ))}
                    </select>
                  )}
                </Camp>

                <Camp
                  nume="oras"
                  id={idc("oras")}
                  eticheta="Localitate"
                  erori={stare.erori["oras"] ?? []}
                >
                  {(a) => (
                    <input
                      {...a}
                      type="text"
                      maxLength={80}
                      defaultValue={stare.valoriTrimise["oras"] ?? punct.oras ?? ""}
                    />
                  )}
                </Camp>

                <Camp
                  nume="cod_postal"
                  id={idc("cod_postal")}
                  eticheta="Cod poștal"
                  erori={stare.erori["cod_postal"] ?? []}
                >
                  {(a) => (
                    <input
                      {...a}
                      type="text"
                      maxLength={10}
                      defaultValue={stare.valoriTrimise["cod_postal"] ?? punct.cod_postal ?? ""}
                    />
                  )}
                </Camp>

                <Camp
                  nume="adresa"
                  id={idc("adresa")}
                  eticheta="Adresă"
                  className="sm:col-span-2"
                  erori={stare.erori["adresa"] ?? []}
                >
                  {(a) => (
                    <input
                      {...a}
                      type="text"
                      maxLength={240}
                      defaultValue={stare.valoriTrimise["adresa"] ?? punct.adresa ?? ""}
                    />
                  )}
                </Camp>

                {/* Bifa rămâne scrisă de mână: `Camp` pune eticheta ÎNAINTEA
                    controlului, iar la o casetă de bifat eticheta stă după —
                    altfel ținta de atingere se rupe în două și rândul se
                    citește invers. */}
                <div className="flex items-center gap-2 sm:col-span-2">
                  <input
                    id={idc("sediu_principal")}
                    name="sediu_principal"
                    type="checkbox"
                    defaultChecked={sediuPrincipal}
                    className={clasaBifa}
                  />
                  <label htmlFor={idc("sediu_principal")} className="text-foreground text-corp">
                    Sediu principal
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <Buton
                    type="submit"
                    varianta="primar"
                    inCurs={stare.inCurs}
                    textInCurs="Se salvează…"
                  >
                    Salvează
                  </Buton>
                </div>
              </>
            );
          }}
        </Formular>
      ) : null}
    </div>
  );
}
