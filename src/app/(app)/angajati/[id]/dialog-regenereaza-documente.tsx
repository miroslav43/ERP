// src/app/(app)/angajati/[id]/dialog-regenereaza-documente.tsx
"use client";

import { useCallback, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Callout } from "@/components/ui/callout";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { arataToast } from "@/components/ui/toast";
import { ETICHETE_SABLON, esteCodInrolare, type CodInrolare } from "@/lib/documents/variabile";

import { regenereazaDocumente } from "./documente/actions";

export type StareDocumentRegenerare = Readonly<{
  cod: CodInrolare;
  /** Numărul documentului ACTIV, dacă există — „CIM 2026/000004". */
  numarAfisat: string | null;
  /** Data emiterii, deja formatată pe server. */
  emisLaAfisat: string | null;
  /** `false` dacă documentul nu se poate emite deloc pentru angajatul ăsta. */
  eligibil: boolean;
  /** De ce nu se poate — se arată lângă bifa dezactivată. */
  motivNeeligibil: string | null;
}>;

/**
 * `coduri` ajunge în `FormData` ca N intrări cu ACELAȘI nume, deci se citește
 * cu `getAll`. `esteCodInrolare` e o gardă de tip: filtrarea îngustează
 * `string[]` la `CodInrolare[]`, adică exact ce cere schema acțiunii — fără
 * nicio conversie forțată.
 */
async function trimite(fd: FormData) {
  return regenereazaDocumente({
    employeeId: String(fd.get("employeeId") ?? ""),
    coduri: fd.getAll("coduri").map(String).filter(esteCodInrolare),
    motiv: String(fd.get("motiv") ?? ""),
  });
}

export type PropsDialogRegenerare = Readonly<{
  employeeId: string;
  documente: readonly StareDocumentRegenerare[];
}>;

/**
 * Regenerarea documentelor unui angajat, dintr-o casetă.
 *
 * ── DE CE BIFELE SUNT CONTROLATE, NU NECONTROLATE ─────────────────────────
 * `stare.valoriTrimise` e `Record<string, string>` — o hartă plată, care nu
 * poate ține N valori pentru aceeași cheie. Trucul cu care celelalte formulare
 * își repun bifele după un refuz (`formular-sablon-componenta-nou.tsx:70-73`)
 * nu se aplică unui grup cu nume comun: ar reține cel mult o bifă din cinci.
 * Starea stă deci în componentă, unde supraviețuiește oricărei respingeri.
 */
export function DialogRegenereazaDocumente({
  employeeId,
  documente,
}: PropsDialogRegenerare): React.ReactElement {
  const eligibile = documente.filter((d) => d.eligibil);
  const [alese, setAlese] = useState<ReadonlySet<CodInrolare>>(new Set());

  const comuta = useCallback((cod: CodInrolare) => {
    setAlese((precedente) => {
      const urmatoare = new Set(precedente);
      if (urmatoare.has(cod)) urmatoare.delete(cod);
      else urmatoare.add(cod);
      return urmatoare;
    });
  }, []);

  const comutaToate = useCallback(() => {
    setAlese((precedente) =>
      precedente.size === eligibile.length ? new Set() : new Set(eligibile.map((d) => d.cod)),
    );
  }, [eligibile]);

  return (
    <FormularDialog
      declansator={{
        eticheta: "Regenerează documente",
        varianta: "secundar",
        pictograma: <RefreshCw aria-hidden="true" className="size-4" />,
        disabled: eligibile.length === 0,
      }}
      titlu="Regenerarea documentelor"
      descriere="Documentele alese se emit din nou, cu textul actual al șabloanelor. Cele vechi rămân în dosar, marcate „Anulat” — un document numerotat nu se șterge."
      marime="mare"
      actiune={trimite}
      etichetaTrimite="Regenerează"
      variantaTrimite="distructiv"
      textInCurs="Se emit…"
      laReusita={(data) => {
        setAlese(new Set());
        const emise = data.documente.length;
        arataToast({
          fel: data.avertismente.length === 0 ? "reusita" : "informativ",
          text:
            emise === 1
              ? `Un document a fost emis din nou${data.anulate.length > 0 ? `; ${data.anulate[0] ?? ""} a fost anulat` : ""}.`
              : `${String(emise)} documente au fost emise din nou; ${String(data.anulate.length)} au fost anulate.`,
        });
        for (const avertisment of data.avertismente) {
          arataToast({ fel: "informativ", text: avertisment });
        }
      }}
    >
      {(stare, idc) => (
        <div className="space-y-4">
          <input type="hidden" name="employeeId" value={employeeId} />

          <fieldset className="space-y-1">
            <legend className="text-eticheta text-muted-foreground mb-2 uppercase">
              Ce se regenerează
            </legend>

            {eligibile.length > 1 ? (
              <label className="border-border flex min-h-11 cursor-pointer items-center gap-3 border-b px-1 pb-2">
                <input
                  type="checkbox"
                  className={clasaBifa}
                  checked={alese.size === eligibile.length && eligibile.length > 0}
                  disabled={stare.inCurs}
                  onChange={comutaToate}
                />
                <span className="font-medium">Toate documentele</span>
              </label>
            ) : null}

            <ul className="divide-border divide-y">
              {documente.map((document) => (
                <li key={document.cod}>
                  <label
                    className={`flex min-h-11 items-center gap-3 px-1 py-2 ${
                      document.eligibil ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className={clasaBifa}
                      name="coduri"
                      value={document.cod}
                      checked={alese.has(document.cod)}
                      disabled={!document.eligibil || stare.inCurs}
                      onChange={() => {
                        comuta(document.cod);
                      }}
                    />
                    <span className="flex-1">
                      <span className="block">{ETICHETE_SABLON[document.cod]}</span>
                      <span className="text-muted-foreground text-nota block">
                        {document.motivNeeligibil ??
                          (document.numarAfisat === null
                            ? "Nu a fost emis încă"
                            : `${document.numarAfisat}${
                                document.emisLaAfisat === null ? "" : ` · ${document.emisLaAfisat}`
                              }`)}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <Camp
            nume="motiv"
            id={idc("motiv")}
            eticheta="De ce se regenerează"
            fel="textarea"
            obligatoriu
            ajutor="Intră în dosarul de personal, ca motiv al anulării documentului vechi."
            erori={stare.erori["motiv"] ?? []}
          >
            {(atribute) => (
              <textarea
                {...atribute}
                rows={2}
                defaultValue={stare.valoriTrimise.motiv ?? ""}
                placeholder="Șablonul de contract a fost actualizat."
              />
            )}
          </Camp>

          {alese.size === 0 ? (
            <Callout fel="informativ" titlu="Niciun document ales">
              Bifează cel puțin un document.
            </Callout>
          ) : null}
        </div>
      )}
    </FormularDialog>
  );
}
