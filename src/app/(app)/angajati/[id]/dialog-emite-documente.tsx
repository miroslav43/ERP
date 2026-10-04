// src/app/(app)/angajati/[id]/dialog-emite-documente.tsx
"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { FilePlus2 } from "lucide-react";

import { Callout } from "@/components/ui/callout";
import { clasaBifa } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { arataToast } from "@/components/ui/toast";

import { emiteDocumente } from "./documente/actions";
import type { OptiuneEmitere } from "./documente/optiuni-emitere";

async function trimite(fd: FormData) {
  return emiteDocumente({
    employeeId: String(fd.get("employeeId") ?? ""),
    coduri: fd.getAll("coduri").map(String),
  });
}

const GRUPURI = [
  { grup: "angajare", titlu: "Documentele angajării" },
  { grup: "firma", titlu: "Documentele firmei" },
] as const;

/**
 * „Emite documente" — tot ce poate genera aplicația pentru angajat, cu bife.
 *
 * Documentele care nu se pot emite rămân în listă, dezactivate, cu motivul
 * scris dedesubt („Emis deja: CIM 2026/000003", „Angajatul nu are fișa postului
 * completată"). Butonul pe care îl înlocuiește răspundea doar „Toate
 * documentele au fost deja emise", fără să spună care și de ce.
 *
 * Bifele sunt controlate, ca la regenerare: `valoriTrimise` e o hartă plată și
 * n-ar putea reține N valori pentru același nume după un refuz.
 */
export function DialogEmiteDocumente({
  employeeId,
  optiuni,
}: Readonly<{
  employeeId: string;
  optiuni: readonly OptiuneEmitere[];
}>): React.ReactElement {
  const [alese, setAlese] = useState<ReadonlySet<string>>(new Set());
  const disponibile = optiuni.filter((o) => o.eligibil);
  const areDocumenteFirma = optiuni.some((o) => o.grup === "firma");

  const comuta = useCallback((cod: string) => {
    setAlese((precedente) => {
      const urmatoare = new Set(precedente);
      if (urmatoare.has(cod)) urmatoare.delete(cod);
      else urmatoare.add(cod);
      return urmatoare;
    });
  }, []);

  return (
    <FormularDialog
      declansator={{
        eticheta: "Emite documente",
        varianta: "secundar",
        pictograma: <FilePlus2 aria-hidden="true" className="size-4" />,
      }}
      titlu="Emiterea documentelor"
      descriere="Fiecare document se generează cu datele angajatului, primește următorul număr din seria lui și se înregistrează în registrul general."
      marime="mare"
      actiune={trimite}
      etichetaTrimite={alese.size > 1 ? `Emite ${String(alese.size)} documente` : "Emite"}
      textInCurs="Se emit…"
      laReusita={(data) => {
        setAlese(new Set());
        const emise = data.documente;
        arataToast({
          fel: data.avertismente.length === 0 ? "reusita" : "informativ",
          text:
            emise.length === 1
              ? `${emise[0]?.denumire ?? "Documentul"} a fost emis: ${emise[0]?.numarAfisat ?? ""}.`
              : `${String(emise.length)} documente au fost emise.`,
        });
        for (const avertisment of data.avertismente) {
          arataToast({ fel: "informativ", text: avertisment });
        }
      }}
    >
      {(stare) => (
        <div className="space-y-5">
          <input type="hidden" name="employeeId" value={employeeId} />

          {GRUPURI.map(({ grup, titlu }) => {
            const dinGrup = optiuni.filter((o) => o.grup === grup);
            if (dinGrup.length === 0) return null;
            return (
              <fieldset key={grup} className="space-y-1">
                <legend className="text-eticheta text-muted-foreground mb-2 uppercase">
                  {titlu}
                </legend>
                <ul className="divide-border divide-y">
                  {dinGrup.map((optiune) => (
                    <li key={optiune.cod}>
                      <label
                        className={`flex min-h-11 items-center gap-3 px-1 py-2 ${
                          optiune.eligibil ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className={clasaBifa}
                          name="coduri"
                          value={optiune.cod}
                          checked={alese.has(optiune.cod)}
                          disabled={!optiune.eligibil || stare.inCurs}
                          onChange={() => {
                            comuta(optiune.cod);
                          }}
                        />
                        <span className="flex-1">
                          <span className="block">{optiune.denumire}</span>
                          <span className="text-muted-foreground text-nota block">
                            {optiune.detaliu}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            );
          })}

          {areDocumenteFirma ? null : (
            <Callout fel="informativ" titlu="Documente proprii ale firmei">
              Pe lângă documentele angajării puteți crea documente proprii — cereri, notificări,
              decizii — în{" "}
              <Link
                href="/angajati/sabloane-documente"
                className="text-primary underline underline-offset-4"
              >
                Șabloane de documente
              </Link>
              . Apar apoi aici, gata de emis.
            </Callout>
          )}

          {disponibile.length === 0 ? (
            <Callout fel="atentie" titlu="Nu e nimic de emis acum">
              Fiecare document de mai sus are scris dedesubt de ce nu se poate emite.
            </Callout>
          ) : alese.size === 0 ? (
            <Callout fel="informativ" titlu="Niciun document ales">
              Bifează documentele pe care vrei să le emiți.
            </Callout>
          ) : null}
        </div>
      )}
    </FormularDialog>
  );
}
