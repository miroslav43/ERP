"use client";

// src/app/(app)/cursuri/biblioteca/formular-material.tsx
//
// Materialul se creează ÎNTÂI ca rând, apoi primește conținut (fișier sau
// link) pe pagina lui. Motivul e practic: calea din Storage conține
// `material_id`, deci fișierul nu poate fi încărcat înainte ca rândul să existe.

import { useCallback, useId, useState } from "react";
import { useRouter } from "next/navigation";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { Dialog } from "@/components/ui/dialog";
import { Formular } from "@/components/ui/formular";
import { CURS_TREAPTA_DOVADA } from "@/schemas/cursuri";

import { creeazaMaterial } from "../actions";
import { ETICHETE_TREAPTA, EXPLICATII_TREAPTA } from "../etichete";

function citeste(date: FormData) {
  const procent = String(date.get("procent_minim") ?? "");
  const prag = String(date.get("prag_test") ?? "");
  return {
    cod: String(date.get("cod") ?? ""),
    titlu: String(date.get("titlu") ?? ""),
    descriere: String(date.get("descriere") ?? ""),
    fel: String(date.get("fel") ?? "pdf"),
    sursa: String(date.get("sursa") ?? "fisier"),
    treapta_dovada: String(date.get("treapta_dovada") ?? "bifa"),
    procent_minim: procent === "" ? null : procent,
    prag_test: prag === "" ? null : prag,
    declaratie_text: String(date.get("declaratie_text") ?? ""),
    transcriere: String(date.get("transcriere") ?? ""),
  };
}

export function FormularMaterialNou() {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [treapta, setTreapta] = useState<string>("bifa");
  const [fel, setFel] = useState<string>("pdf");
  const idFormular = useId();
  const idc = (sufix: string): string => `${idFormular}-${sufix}`;

  const laReusita = useCallback(
    (date: { id: string }): void => {
      setDeschis(false);
      router.push(`/cursuri/biblioteca/${date.id}`);
      router.refresh();
    },
    [router],
  );

  return (
    <>
      <Buton
        varianta="primar"
        onClick={() => {
          setDeschis(true);
        }}
      >
        Material nou
      </Buton>

      <Dialog
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu="Material nou"
        descriere="După ce îl creați, îi încărcați fișierul sau îi lipiți linkul."
        marime="lucru"
      >
        <Formular
          actiune={async (date) => creeazaMaterial(citeste(date))}
          laReusita={laReusita}
          mesajReusita="Materialul a fost creat."
          className="grid gap-4 sm:grid-cols-2"
        >
          {(stare) => (
            <>
              <Camp
                nume="titlu"
                id={idc("titlu")}
                eticheta="Titlu"
                obligatoriu
                erori={stare.erori["titlu"] ?? []}
              >
                {(a) => (
                  <input {...a} type="text" maxLength={200} defaultValue={stare.valoriTrimise["titlu"] ?? ""} />
                )}
              </Camp>

              <Camp nume="cod" id={idc("cod")} eticheta="Cod" obligatoriu erori={stare.erori["cod"] ?? []}>
                {(a) => (
                  <input {...a} type="text" maxLength={40} defaultValue={stare.valoriTrimise["cod"] ?? ""} />
                )}
              </Camp>

              <Camp
                nume="fel"
                id={idc("fel")}
                eticheta="Fel"
                fel="select"
                erori={stare.erori["fel"] ?? []}
              >
                {(a) => (
                  <select
                    {...a}
                    value={fel}
                    onChange={(e) => {
                      setFel(e.target.value);
                      // Parcurgerea măsurată există doar la filme; dacă omul
                      // trece pe document, treapta se retrage singură, ca să nu
                      // trimită o combinație pe care baza o refuză.
                      if (e.target.value !== "video" && treapta === "parcurgere") setTreapta("bifa");
                    }}
                  >
                    <option value="pdf">Document (PDF)</option>
                    <option value="video">Film</option>
                  </select>
                )}
              </Camp>

              <Camp
                nume="sursa"
                id={idc("sursa")}
                eticheta="Sursă"
                fel="select"
                {...(fel === "pdf" ? { ajutor: "Documentele se încarcă în aplicație." } : {})}
                erori={stare.erori["sursa"] ?? []}
              >
                {(a) => (
                  <select {...a} defaultValue="fisier" disabled={fel === "pdf"}>
                    <option value="fisier">Încărcat în aplicație</option>
                    <option value="link">Link extern (YouTube, Vimeo, Loom)</option>
                  </select>
                )}
              </Camp>

              <Camp
                nume="treapta_dovada"
                id={idc("treapta_dovada")}
                eticheta="Cum se dovedește parcurgerea"
                fel="select"
                ajutor={EXPLICATII_TREAPTA[treapta as keyof typeof EXPLICATII_TREAPTA]}
                className="sm:col-span-2"
                erori={stare.erori["treapta_dovada"] ?? []}
              >
                {(a) => (
                  <select
                    {...a}
                    value={treapta}
                    onChange={(e) => {
                      setTreapta(e.target.value);
                    }}
                  >
                    {CURS_TREAPTA_DOVADA.map((t) => (
                      <option key={t} value={t} disabled={t === "parcurgere" && fel !== "video"}>
                        {ETICHETE_TREAPTA[t]}
                        {t === "parcurgere" && fel !== "video" ? " — doar la filme" : ""}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              {treapta === "parcurgere" ? (
                <Camp
                  nume="procent_minim"
                  id={idc("procent_minim")}
                  eticheta="Procent minim urmărit"
                  obligatoriu
                  erori={stare.erori["procent_minim"] ?? []}
                >
                  {(a) => (
                    <input {...a} type="number" min={1} max={100} defaultValue={stare.valoriTrimise["procent_minim"] ?? "80"} />
                  )}
                </Camp>
              ) : null}

              {treapta === "test" ? (
                <Camp
                  nume="prag_test"
                  id={idc("prag_test")}
                  eticheta="Nota minimă de trecere"
                  obligatoriu
                  ajutor="Din 100. Nota o calculează baza, din răspunsurile corecte."
                  erori={stare.erori["prag_test"] ?? []}
                >
                  {(a) => (
                    <input
                      {...a}
                      type="number"
                      min={1}
                      max={100}
                      defaultValue={stare.valoriTrimise["prag_test"] ?? "70"}
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
                  className="sm:col-span-2"
                  erori={stare.erori["declaratie_text"] ?? []}
                >
                  {(a) => (
                    <textarea
                      {...a}
                      rows={3}
                      maxLength={4000}
                      defaultValue={
                        stare.valoriTrimise["declaratie_text"] ??
                        "Declar că am citit și am înțeles conținutul acestui material."
                      }
                    />
                  )}
                </Camp>
              ) : null}

              <Camp
                nume="descriere"
                id={idc("descriere")}
                eticheta="Descriere"
                fel="textarea"
                className="sm:col-span-2"
                erori={stare.erori["descriere"] ?? []}
              >
                {(a) => <textarea {...a} rows={2} maxLength={2000} defaultValue={stare.valoriTrimise["descriere"] ?? ""} />}
              </Camp>

              <BaraActiuni className="sm:col-span-2">
                <Buton type="submit" varianta="primar" inCurs={stare.inCurs} textInCurs="Se creează…">
                  Creează materialul
                </Buton>
                <Buton
                  varianta="tertiar"
                  onClick={() => {
                    setDeschis(false);
                  }}
                >
                  Renunță
                </Buton>
              </BaraActiuni>
            </>
          )}
        </Formular>
      </Dialog>
    </>
  );
}
