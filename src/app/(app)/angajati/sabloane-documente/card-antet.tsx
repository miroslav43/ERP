// src/app/(app)/angajati/sabloane-documente/card-antet.tsx
"use client";

import Image from "next/image";
import { useCallback, useId, useRef, useState, useTransition } from "react";

import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { arataToast } from "@/components/ui/toast";
import {
  campuriLegaleLipsa,
  randuriBlocFirma,
  type AntetOrganizatie,
  type PozitieAntet,
} from "@/lib/documents/bloc-firma";
import { SIGLA_MIME_ACCEPTAT, SIGLA_OCTETI_MAXIM } from "@/schemas/document-template";
import { urcaPeUrlSemnat } from "@/lib/storage/urca-semnat";

import { pregatesteSigla, salveazaAntetDocumente, salveazaSigla, stergeSigla } from "./actions";

/**
 * Configurarea blocului de identificare a firmei, tipărit pe fiecare document.
 *
 * ── DE CE AICI, ȘI NU ÎN PROFILUL FIRMEI ───────────────────────────────────
 * DATELE stau în profilul firmei (`/setari/organizatie`) și de acolo se
 * schimbă. Ce se alege aici e cum arată DOCUMENTELE: sus sau jos, cu siglă sau
 * fără. Locul lui e lângă șabloane, unde omul se uită oricum la cum va ieși
 * hârtia. Cardul doar arată datele, iar când îi lipsește ceva cerut de lege
 * trimite exact acolo unde se completează.
 *
 * ── DE CE PREVIZUALIZAREA FOLOSEȘTE `randuriBlocFirma` ─────────────────────
 * E aceeași funcție pe care o cheamă și PDF-ul, și HTML-ul de tipărit. O
 * previzualizare scrisă separat ar fi a doua interpretare a art. 74 din Legea
 * 31/1990, liberă să diveargă de hârtie fără ca nimeni să observe.
 */
export type PropsCardAntet = Readonly<{
  antet: AntetOrganizatie;
  urlSigla: string | null;
  /** `false` pentru rolurile fără `branding:update` — cardul rămâne în citire. */
  poateEdita: boolean;
}>;

const ETICHETE: Readonly<Record<PozitieAntet, string>> = {
  antet: "În antet, sus pe pagină",
  subsol: "În subsol, jos pe fiecare pagină",
};

export function CardAntetDocumente({
  antet,
  urlSigla,
  poateEdita,
}: PropsCardAntet): React.ReactElement {
  const [pozitie, setPozitie] = useState<PozitieAntet>(antet.pozitie);
  const [inCurs, startTransition] = useTransition();
  const [seIncarca, setSeIncarca] = useState(false);
  const idPozitie = useId();
  const fisierRef = useRef<HTMLInputElement>(null);

  const randuri = randuriBlocFirma({ ...antet, pozitie });
  const lipsa = campuriLegaleLipsa(antet);

  const schimbaPozitia = useCallback(
    (noua: PozitieAntet) => {
      const veche = pozitie;
      setPozitie(noua);
      startTransition(async () => {
        const rezultat = await salveazaAntetDocumente({
          pozitie: noua,
          arata_logo: urlSigla !== null,
        });
        if (rezultat.ok) {
          arataToast({ fel: "reusita", text: "Antetul documentelor a fost salvat." });
          return;
        }
        // Întoarcerea la valoarea veche, nu doar un mesaj: altfel butonul rămâne
        // apăsat pe o alegere pe care baza a refuzat-o.
        setPozitie(veche);
        arataToast({ fel: "eroare", text: rezultat.error.message });
      });
    },
    [pozitie, urlSigla],
  );

  const incarcaSigla = useCallback((fisier: File) => {
    setSeIncarca(true);
    startTransition(async () => {
      try {
        if (fisier.size > SIGLA_OCTETI_MAXIM) {
          arataToast({ fel: "eroare", text: "Sigla nu poate depăși 512 KB." });
          return;
        }
        if (!(SIGLA_MIME_ACCEPTAT as readonly string[]).includes(fisier.type)) {
          arataToast({ fel: "eroare", text: "Sigla trebuie să fie PNG sau JPEG." });
          return;
        }

        const pregatit = await pregatesteSigla({
          numeFisier: fisier.name,
          dimensiune: fisier.size,
          mime: fisier.type,
        });
        if (!pregatit.ok) {
          arataToast({ fel: "eroare", text: pregatit.error.message });
          return;
        }

        // Octeții urcă DIRECT în Storage, nu prin server — vezi `urca-semnat.ts`.
        if (!(await urcaPeUrlSemnat(pregatit.data.urlSemnat, fisier))) {
          arataToast({ fel: "eroare", text: "Sigla nu a putut fi încărcată. Încearcă din nou." });
          return;
        }

        const salvat = await salveazaSigla({ cale: pregatit.data.cale });
        arataToast(
          salvat.ok
            ? { fel: "reusita", text: "Sigla a fost salvată." }
            : { fel: "eroare", text: salvat.error.message },
        );
      } finally {
        setSeIncarca(false);
        if (fisierRef.current !== null) fisierRef.current.value = "";
      }
    });
  }, []);

  const scoateSigla = useCallback(() => {
    startTransition(async () => {
      const rezultat = await stergeSigla({});
      arataToast(
        rezultat.ok
          ? { fel: "reusita", text: "Sigla a fost scoasă de pe documente." }
          : { fel: "eroare", text: rezultat.error.message },
      );
    });
  }, []);

  return (
    <section className="border-border rounded-panou space-y-4 border p-4">
      <div>
        <h2 className="font-medium">Antetul documentelor</h2>
        <p className="text-muted-foreground text-nota mt-1">
          Datele de identificare ale firmei se tipăresc pe fiecare document emis — contract, fișa
          postului, anexe, adeverințe, fluturași și state de plată. Legea 31/1990 art. 74 le cere
          prezente în document; unde anume, alegeți dumneavoastră.
        </p>
      </div>

      {/* Previzualizarea: exact rândurile pe care le desenează PDF-ul. */}
      <div className="bg-muted/40 border-border rounded-panou flex items-start gap-3 border p-3">
        {urlSigla === null ? null : (
          <Image
            src={urlSigla}
            alt="Sigla firmei"
            width={120}
            height={48}
            unoptimized
            className="h-12 w-auto max-w-30 object-contain"
          />
        )}
        <div className="min-w-0">
          {randuri.map((rand, index) => (
            <p
              key={rand}
              className={index === 0 ? "font-medium" : "text-muted-foreground text-nota"}
            >
              {rand}
            </p>
          ))}
        </div>
      </div>

      {lipsa.length === 0 ? null : (
        <Callout fel="atentie" titlu="Antetul nu are tot ce cere legea">
          Lipsesc: {lipsa.join(", ")}. Legea 31/1990 art. 74 le cere pe documentele emise de
          societate, iar art. 270³ sancționează lipsa lor cu amendă de la 2.500 la 5.000 lei.
          Completați-le în{" "}
          <a href="/setari/organizatie" className="underline">
            profilul firmei
          </a>
          .
        </Callout>
      )}

      {!poateEdita ? (
        <p className="text-muted-foreground text-nota">
          Antetul și sigla se schimbă de către un administrator al firmei.
        </p>
      ) : (
        <div className="space-y-4">
          <fieldset className="space-y-2" disabled={inCurs}>
            <legend className="text-eticheta text-muted-foreground uppercase">
              Unde se tipărește
            </legend>
            {(Object.keys(ETICHETE) as readonly PozitieAntet[]).map((valoare) => (
              <label key={valoare} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={idPozitie}
                  value={valoare}
                  checked={pozitie === valoare}
                  onChange={() => {
                    schimbaPozitia(valoare);
                  }}
                />
                <span>{ETICHETE[valoare]}</span>
              </label>
            ))}
          </fieldset>

          <div className="space-y-2">
            <p className="text-eticheta text-muted-foreground uppercase">Sigla firmei</p>
            <p className="text-muted-foreground text-nota">
              Opțională — nicio normă nu o cere. PNG sau JPEG, cel mult 512 KB.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fisierRef}
                type="file"
                accept={SIGLA_MIME_ACCEPTAT.join(",")}
                disabled={inCurs || seIncarca}
                className="text-nota"
                onChange={(eveniment) => {
                  const fisier = eveniment.target.files?.[0];
                  if (fisier !== undefined) incarcaSigla(fisier);
                }}
              />
              {urlSigla === null ? null : (
                <Buton
                  varianta="secundar"
                  type="button"
                  disabled={inCurs || seIncarca}
                  onClick={scoateSigla}
                >
                  Scoate sigla
                </Buton>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
