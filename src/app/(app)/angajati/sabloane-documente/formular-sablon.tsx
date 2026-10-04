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
import { creeazaSablonPersonalizat, salveazaSablonDocument } from "./actions";
import { ButonPrevizualizare } from "./buton-previzualizare";
import { EditorSablon } from "./editor-sablon";

export type PropsFormularSablon = Readonly<{
  /**
   * Codul șablonului editat — deja verificat de pagină, care face `notFound()`
   * pentru orice cod necunoscut. `cod` nu vine din `FormData`, ci din
   * închiderea peste prop.
   *
   * `null` = document NOU al firmei: formularul cere și seria de numerotare,
   * iar codul îl deduce acțiunea din denumire.
   */
  cod: string | null;
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

  const esteNou = cod === null;

  const trimite = useCallback(
    async (fd: FormData) =>
      cod === null
        ? creeazaSablonPersonalizat({
            denumire: String(fd.get("denumire") ?? ""),
            serie: String(fd.get("serie") ?? ""),
            continut_html: String(fd.get("continut_html") ?? ""),
          })
        : salveazaSablonDocument({
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
        arataToast({
          fel: "reusita",
          text: esteNou
            ? "Documentul a fost creat. Îl puteți emite din fișa oricărui angajat, secțiunea Documente."
            : "Șablonul a fost salvat.",
        });
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

          {esteNou ? (
            <Camp
              nume="serie"
              eticheta="Seria de numerotare"
              obligatoriu
              ajutor="Între 2 și 8 litere. Documentele se numerotează pe serie: „CER 2026/000001”. Seria nu se mai poate schimba după creare."
              erori={stare.erori["serie"] ?? []}
            >
              {(atribute) => (
                <input
                  {...atribute}
                  maxLength={8}
                  autoCapitalize="characters"
                  className={`${atribute.className} uppercase`}
                  defaultValue={stare.valoriTrimise["serie"] ?? ""}
                  placeholder="CER"
                />
              )}
            </Camp>
          ) : null}

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
            {/*
             * Butonul stă ÎN formular, deliberat: citește conținutul prin
             * `FormData` de pe același `<form>`, deci previzualizarea e exact ce
             * s-ar salva. `type="button"` îl ține departe de trimitere.
             */}
            <ButonPrevizualizare cod={cod} inCurs={stare.inCurs} />
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
              {esteNou ? "Creează documentul" : "Salvează șablonul"}
            </Buton>
          </BaraActiuni>
        </div>
      )}
    </Formular>
  );
}
