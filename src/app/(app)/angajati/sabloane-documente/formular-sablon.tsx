// src/app/(app)/angajati/sabloane-documente/formular-sablon.tsx
"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import { arataToast } from "@/components/ui/toast";
import type { CodInrolare } from "@/lib/documents/variabile";

import { salveazaSablonDocument } from "./actions";
import { EditorSablon } from "./editor-sablon";

export type PropsFormularSablon = Readonly<{
  /**
   * Deja îngustat de pagină, care face `notFound()` pentru orice altceva. Tipul
   * ăsta e motivul pentru care `trimite` nu mai are nevoie de o gardă proprie:
   * `cod` nu vine din `FormData`, ci din închiderea peste prop.
   */
  cod: CodInrolare;
  denumire: string;
  continutInitial: string;
  variabile: readonly string[];
  /** `true` dacă firma editează pentru prima dată textul de platformă. */
  esteClona: boolean;
}>;

export function FormularSablon({
  cod,
  denumire,
  continutInitial,
  variabile,
  esteClona,
}: PropsFormularSablon): React.ReactElement {
  const router = useRouter();

  const trimite = useCallback(
    async (fd: FormData) =>
      salveazaSablonDocument({
        cod,
        denumire: String(fd.get("denumire") ?? ""),
        continut_html: String(fd.get("continut_html") ?? ""),
      }),
    [cod],
  );

  return (
    <Formular
      actiune={trimite}
      laReusita={() => {
        arataToast({ fel: "reusita", text: "Șablonul a fost salvat." });
        router.push("/angajati/sabloane-documente");
        router.refresh();
      }}
    >
      {(stare) => (
        <div className="space-y-6">
          {stare.eroareGenerala === null ? null : (
            <Callout fel="eroare" titlu="Șablonul nu a fost salvat">
              {stare.eroareGenerala}
            </Callout>
          )}

          {esteClona ? (
            <Callout fel="informativ" titlu="Se creează o copie a firmei">
              Textul de mai jos e cel livrat cu aplicația. La salvare se creează o copie proprie a
              firmei; varianta de platformă rămâne neatinsă și puteți reveni oricând la ea.
            </Callout>
          ) : null}

          <Camp
            nume="denumire"
            eticheta="Denumirea documentului"
            obligatoriu
            ajutor="Apare ca titlu în antetul PDF-ului și în lista de documente a angajatului."
            erori={stare.erori["denumire"] ?? []}
          >
            {(atribute) => (
              <input {...atribute} defaultValue={stare.valoriTrimise["denumire"] ?? denumire} />
            )}
          </Camp>

          <div className="space-y-2">
            <p className="text-eticheta text-muted-foreground uppercase">Conținutul documentului</p>
            <EditorSablon
              continutInitial={continutInitial}
              variabile={variabile}
              nume="continut_html"
              inCurs={stare.inCurs}
            />
            {(stare.erori["continut_html"] ?? []).map((eroare) => (
              <p key={eroare} className="text-danger text-nota">
                {eroare}
              </p>
            ))}
          </div>

          <BaraActiuni aliniere="final" separata lipitaPeTelefon>
            <Buton
              varianta="secundar"
              type="button"
              disabled={stare.inCurs}
              onClick={() => {
                router.push("/angajati/sabloane-documente");
              }}
            >
              Renunță
            </Buton>
            <Buton varianta="primar" type="submit" inCurs={stare.inCurs} textInCurs="Se salvează…">
              Salvează șablonul
            </Buton>
          </BaraActiuni>
        </div>
      )}
    </Formular>
  );
}
