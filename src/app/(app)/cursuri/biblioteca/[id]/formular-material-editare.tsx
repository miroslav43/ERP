"use client";

// src/app/(app)/cursuri/biblioteca/[id]/formular-material-editare.tsx
//
// `actualizeazaMaterial` exista de la prima livrare fără niciun apelant. Un cod
// greșit, un titlu scris în grabă sau o treaptă de dovadă aleasă din reflex
// rămâneau definitive — singura ieșire era ștergerea materialului, pe care baza
// o refuză cât timp cineva îl parcurge (`cursuri_protejeaza_catalogul`).
//
// ── FELUL ȘI SURSA SUNT ÎNGHEȚATE ───────────────────────────────────────────
// Versiunile deja încărcate depind de ele: un material trecut din „film
// încărcat" în „link extern" ar avea versiuni cu fișier și o sursă care spune
// că n-ar trebui să existe. Baza NU apără asta — triggerul de pe
// `course_materials` se uită numai la ștergere — deci apărarea e aici.
//
// Se randează ca rezumat inert, NU ca radiouri cu toate opțiunile stinse:
// schema cere `fel` și `sursa` obligatoriu, iar un grup de radio complet stins
// e o promisiune de alegere pe care ecranul n-o poate ține. Valoarea nici măcar
// nu ajunge în DOM — `citesteMaterialEditat` o primește din props, deci nu
// există ce trimite altfel.
//
// ── CE NU SE STRICĂ LA SCHIMBAREA TREPTEI ───────────────────────────────────
// `course_enrollment_items` materializează treapta la înrolare. Cine e la
// jumătate rămâne pe contractul de atunci; treapta nouă se aplică înrolărilor
// următoare. De aceea schimbarea ei e permisă fără ceremonie.

import { Pencil } from "lucide-react";
import { useCallback, useState } from "react";

import { AlegereCarduri, type OptiuneCard } from "@/components/ui/alegere-carduri";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { ListaDefinitii } from "@/components/ui/lista-definitii";
import type { CursTreaptaDovada, CursTreaptaOferita } from "@/schemas/cursuri";

import { actualizeazaMaterial } from "../../actions";
import { alegereDinFel, citesteMaterialEditat } from "../../_formulare/citire";
import { ETICHETE_FEL, ETICHETE_SURSA, ETICHETE_TREAPTA, EXPLICATII_TREAPTA } from "../../etichete";

interface Proprietati {
  readonly material: Readonly<{
    id: string;
    cod: string;
    titlu: string;
    descriere: string | null;
    fel: "pdf" | "video";
    sursa: "fisier" | "link";
    treapta_dovada: CursTreaptaDovada;
    procent_minim: number | null;
    prag_test: number | null;
    declaratie_text: string | null;
    transcriere: string | null;
  }>;
}

export function FormularMaterialEditare({ material }: Proprietati) {
  const ales = alegereDinFel(material.fel, material.sursa);
  const esteFilmPropriu = ales === "video_fisier";
  const esteFilm = material.fel === "video";

  const [treapta, setTreapta] = useState<CursTreaptaOferita>(
    // `parcurgere` pe un material care nu mai poate să o susțină ar bloca
    // salvarea din prima. Nu se întâmplă azi, dar tot ecranul de mai jos
    // presupune că treapta curentă e una ofertabilă.
    material.treapta_dovada === "parcurgere" && !esteFilmPropriu
      ? "bifa"
      : (material.treapta_dovada as CursTreaptaOferita),
  );
  const [faraVorbire, setFaraVorbire] = useState(
    material.transcriere === "Filmul nu conține vorbire.",
  );

  /** Aceleași motive ca în asistent: treapta imposibilă își spune de ce. */
  const optiuniTreapta: readonly OptiuneCard[] = (
    ["bifa", "parcurgere", "test", "declaratie"] as const
  ).map((t) => {
    const baza = { valoare: t, eticheta: ETICHETE_TREAPTA[t], descriere: EXPLICATII_TREAPTA[t] };
    if (t === "parcurgere" && !esteFilmPropriu) {
      return {
        ...baza,
        indisponibil: true as const,
        motiv:
          material.fel === "pdf"
            ? "Se poate măsura doar la filme."
            : "Filmul rulează la furnizor, care nu ne spune cât s-a văzut.",
      };
    }
    return baza;
  });

  const trimite = useCallback(
    async (date: FormData) => actualizeazaMaterial(citesteMaterialEditat(date, material.id, ales)),
    [material.id, ales],
  );

  return (
    <FormularDialog
      declansator={{
        eticheta: "Modifică detaliile materialului",
        varianta: "secundar",
        pictograma: <Pencil aria-hidden="true" className="size-4" />,
      }}
      titlu={`Modifică „${material.titlu}”`}
      descriere="Felul și sursa materialului sunt înghețate: schimbarea lor ar invalida dovezile de parcurgere deja strânse. Treapta de dovadă se poate schimba — se aplică de la versiunea următoare."
      marime="lucru"
      actiune={trimite}
      mesajReusita="Materialul a fost salvat."
      etichetaTrimite="Salvează materialul"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="space-y-4">
          {/* Rezumatul inert al celor două câmpuri înghețate. */}
          <ListaDefinitii
            coloane={2}
            textNecompletat="—"
            definitii={[
              { eticheta: "Fel", valoare: ETICHETE_FEL[material.fel] },
              { eticheta: "Sursă", valoare: ETICHETE_SURSA[material.sursa] },
            ]}
          />
          <p className="text-muted-foreground text-nota">
            Felul și sursa nu se mai schimbă: versiunile deja încărcate depind de ele. Pentru alt
            fel de conținut, faceți un material nou.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Camp
              nume="titlu"
              id={idc("titlu")}
              eticheta="Titlu"
              obligatoriu
              erori={stare.erori["titlu"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={200}
                  defaultValue={stare.valoriTrimise["titlu"] ?? material.titlu}
                />
              )}
            </Camp>

            <Camp
              nume="cod"
              id={idc("cod")}
              eticheta="Cod"
              obligatoriu
              ajutor="Litere mici, cifre și liniuță jos — fără spații."
              erori={stare.erori["cod"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={40}
                  defaultValue={stare.valoriTrimise["cod"] ?? material.cod}
                />
              )}
            </Camp>

            <Camp
              nume="descriere"
              id={idc("descriere")}
              eticheta="Descriere"
              fel="textarea"
              className="sm:col-span-2"
              erori={stare.erori["descriere"] ?? []}
            >
              {(a) => (
                <textarea
                  {...a}
                  rows={2}
                  maxLength={2000}
                  defaultValue={stare.valoriTrimise["descriere"] ?? material.descriere ?? ""}
                />
              )}
            </Camp>
          </div>

          <AlegereCarduri
            nume="treapta_dovada"
            eticheta="Cum se dovedește că a fost parcurs"
            optiuni={optiuniTreapta}
            coloane={2}
            valoare={treapta}
            laSchimbare={(v) => {
              setTreapta(v as CursTreaptaOferita);
            }}
          />

          {treapta === "parcurgere" ? (
            <Camp
              nume="procent_minim"
              id={idc("procent_minim")}
              eticheta="Procent minim urmărit"
              obligatoriu
              erori={stare.erori["procent_minim"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={
                    stare.valoriTrimise["procent_minim"] ??
                    (material.procent_minim === null ? "80" : String(material.procent_minim))
                  }
                />
              )}
            </Camp>
          ) : null}

          {treapta === "test" ? (
            <Camp
              nume="prag_test"
              id={idc("prag_test")}
              eticheta="Nota minimă de trecere"
              obligatoriu
              ajutor="Din 100. Întrebările se scriu mai jos, pe versiunea curentă."
              erori={stare.erori["prag_test"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={
                    stare.valoriTrimise["prag_test"] ??
                    (material.prag_test === null ? "80" : String(material.prag_test))
                  }
                />
              )}
            </Camp>
          ) : null}

          {treapta === "declaratie" ? (
            <Camp
              nume="declaratie_text"
              id={idc("declaratie_text")}
              eticheta="Textul pe care îl asumă angajatul"
              fel="textarea"
              obligatoriu
              ajutor="Se înregistrează numele, data, adresa IP și versiunea exactă a materialului."
              erori={stare.erori["declaratie_text"] ?? []}
            >
              {(a) => (
                <textarea
                  {...a}
                  rows={3}
                  maxLength={4000}
                  defaultValue={
                    stare.valoriTrimise["declaratie_text"] ?? material.declaratie_text ?? ""
                  }
                />
              )}
            </Camp>
          ) : null}

          {/*
            Transcrierea pentru materialele DEJA create. Coloana traversa patru
            straturi și era afișată în portal, dar singurul scriitor era
            asistentul de material nou — deci filmele urcate înainte rămâneau
            fără ea pentru totdeauna. Pentru un angajat surd, un film fără
            transcriere e un curs pe care nu-l poate face.
          */}
          {esteFilm ? (
            <div className="space-y-2">
              <label className="flex min-h-11 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  name="fara_vorbire"
                  checked={faraVorbire}
                  onChange={(e) => {
                    setFaraVorbire(e.target.checked);
                  }}
                  className={clasaBifa}
                />
                <span className="text-corp">Filmul nu conține vorbire.</span>
              </label>

              {faraVorbire ? null : (
                <Camp
                  nume="transcriere"
                  id={idc("transcriere")}
                  eticheta="Transcrierea filmului"
                  fel="textarea"
                  ajutor="Textul rostit în film. Se vede lângă player, pentru cine nu aude sau nu poate porni sunetul."
                  erori={stare.erori["transcriere"] ?? []}
                >
                  {(a) => (
                    <textarea
                      {...a}
                      rows={6}
                      maxLength={50000}
                      defaultValue={
                        stare.valoriTrimise["transcriere"] ??
                        (material.transcriere === "Filmul nu conține vorbire."
                          ? ""
                          : (material.transcriere ?? ""))
                      }
                    />
                  )}
                </Camp>
              )}
            </div>
          ) : null}
        </div>
      )}
    </FormularDialog>
  );
}
