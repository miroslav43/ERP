"use client";

// src/app/(app)/cursuri/biblioteca/nou/asistent-material.tsx
//
// Asistentul de material: cinci pași, cu ramificare din prima alegere.
//
// ── DE CE NU react-hook-form, deși cei trei asistenți din proiect îl folosesc ─
// Aceia au o singură trimitere la final, iar RHF există exact pentru asta:
// validare pe pas, `trigger`, `onInvalid`, maparea erorii de server înapoi pe
// pasul vinovat. Aici nu există o singură trimitere. Pasul 4 nu e un câmp, e un
// PROCES: creează rândul, semnează încărcarea, urcă octeții, verifică semnătura
// de fișier — patru drumuri la server, cu stări proprii și cu o curățare
// obligatorie la eșec. RHF n-ar administra nimic din asta și ar adăuga o a doua
// sursă de adevăr peste starea pe care oricum trebuie s-o țin.
//
// Validarea pe pas rămâne, dar direct pe schemele Zod reale: pasul 3 rulează
// `creeazaMaterialSchema` ÎNTREG, deci orice combinație imposibilă (PDF prin
// link, parcurgere măsurată pe film extern) cade înainte să se creeze ceva.
//
// ── DE CE RÂNDUL SE CREEAZĂ LA PASUL 4, NU LA FINAL ──────────────────────────
// Calea din Storage conține `material_id`, deci fișierul nu poate urca înainte
// ca rândul să existe. Alternativa — un identificator de ciornă generat în
// client — ar muta gunoiul din bază în bucket, iar `storage.objects` NU are
// politică DELETE: un obiect a cărui cale n-o știe nimeni e pierdut definitiv.
// Un rând-ciornă e gunoi CATALOGAT: apare în bibliotecă cu insigna „Lipsă" și
// se poate șterge. Granița e anunțată pe ecran, nu tăcută.

import { useCallback, useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, FileText, Film, Link2 } from "lucide-react";

import { AlegereCarduri, type OptiuneCard } from "@/components/ui/alegere-carduri";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Camp, clasaBifa, clasaControl } from "@/components/ui/camp";
import { IncarcareFisier } from "@/components/ui/incarcare-fisier";
import { ListaDefinitii } from "@/components/ui/lista-definitii";
import { ProgresPasi } from "@/components/ui/progres-pasi";
import { arataToast } from "@/components/ui/toast";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import {
  BUCKET_CURSURI,
  LIMITA_PDF_BYTES,
  LIMITA_VIDEO_BYTES,
  MIME_PDF,
  MIME_VIDEO,
  RESTRICTII_INCARCARE,
  verificaMaterial,
} from "@/lib/media/cale";
import { analizeazaLink, ETICHETE_FURNIZOR } from "@/lib/media/link-extern";
import { creeazaMaterialSchema, type CursTreaptaOferita } from "@/schemas/cursuri";

import {
  felDinAlegere,
  intrareMaterial,
  intrareVersiuneFisier,
  intrareVersiuneLink,
  type FelAles,
} from "../../_formulare/citire";
import {
  creeazaMaterial,
  pregatesteIncarcareMaterial,
  renuntaLaIncarcare,
  salveazaVersiuneFisier,
  salveazaVersiuneLink,
} from "../../actions";
import { ETICHETE_TREAPTA, EXPLICATII_TREAPTA } from "../../etichete";

const ETICHETE_PASI = [
  "Ce fel de material",
  "Cum se numește",
  "Cum se dovedește",
  "Conținutul",
  "Gata",
] as const;

/** Cele trei feluri, ca o singură alegere: felul și sursa merg împreună. */
type Fel = FelAles;

const OPTIUNI_FEL: readonly OptiuneCard[] = [
  {
    valoare: "pdf",
    eticheta: "Document PDF",
    descriere: "Un regulament, o procedură, o fișă. Se citește în aplicație.",
    pictograma: FileText,
  },
  {
    valoare: "video_fisier",
    eticheta: "Film încărcat",
    descriere: "Filmul urcă în aplicație. Doar aici se poate măsura cât s-a urmărit.",
    pictograma: Film,
  },
  {
    valoare: "video_link",
    eticheta: "Film din link",
    descriere: "YouTube, Vimeo sau Loom. Nu ocupă spațiu, dar parcurgerea nu se poate măsura.",
    pictograma: Link2,
  },
];

type Stadiu =
  | Readonly<{ tip: "inactiv" }>
  | Readonly<{ tip: "lucru"; mesaj: string }>
  | Readonly<{ tip: "eroare"; mesaj: string }>;

export function AsistentMaterial() {
  const router = useRouter();
  const idFormular = useId();
  const idc = (sufix: string): string => `${idFormular}-${sufix}`;
  const [, porneste] = useTransition();

  const [pas, setPas] = useState(1);
  const [erori, setErori] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [stadiu, setStadiu] = useState<Stadiu>({ tip: "inactiv" });

  // Pasul 1
  const [alegere, setAlegere] = useState<Fel>("pdf");
  // Pasul 2
  const [titlu, setTitlu] = useState("");
  const [cod, setCod] = useState("");
  const [descriere, setDescriere] = useState("");
  // Pasul 3
  const [treapta, setTreapta] = useState<CursTreaptaOferita>("bifa");
  const [procentMinim, setProcentMinim] = useState("80");
  const [pragTest, setPragTest] = useState("70");
  const [declaratieText, setDeclaratieText] = useState(
    "Declar că am citit și am înțeles conținutul acestui material.",
  );
  // Pasul 4
  const [fisier, setFisier] = useState<File | null>(null);
  const [adresa, setAdresa] = useState("");
  const [durata, setDurata] = useState("");
  const [transcriere, setTranscriere] = useState("");
  const [faraVorbire, setFaraVorbire] = useState(false);
  // Rezultatul
  const [materialId, setMaterialId] = useState<string | null>(null);

  const { fel, sursa } = felDinAlegere(alegere);
  const esteFilmPropriu = alegere === "video_fisier";

  /**
   * Ce pleacă la server. Construit de o funcție PURĂ dintr-un fișier frate,
   * nu aici: testul din `_formulare/citire.test.ts` o rulează pe ea și dă
   * rezultatul schemei reale. Dacă ecranul ar construi obiectul singur, testul
   * ar măsura un contract pe care nimeni nu-l folosește — exact felul în care
   * 1868 de teste au trecut peste un modul mort.
   */
  const sarcina = useMemo(
    () =>
      intrareMaterial({
        ales: alegere,
        cod,
        titlu,
        descriere,
        treapta,
        procentMinim,
        pragTest,
        declaratieText,
        transcriere,
        faraVorbire,
      }),
    [
      alegere,
      cod,
      declaratieText,
      descriere,
      faraVorbire,
      pragTest,
      procentMinim,
      titlu,
      transcriere,
      treapta,
    ],
  );

  /** Treptele imposibile pentru alegerea de la pasul 1, cu motivul scris. */
  const optiuniTreapta: readonly OptiuneCard[] = (
    ["bifa", "parcurgere", "test", "declaratie"] as const
  ).map((t) => {
    const baza = {
      valoare: t,
      eticheta: ETICHETE_TREAPTA[t],
      descriere: EXPLICATII_TREAPTA[t],
    };
    if (t === "parcurgere" && !esteFilmPropriu) {
      return {
        ...baza,
        indisponibil: true as const,
        motiv:
          fel === "pdf"
            ? "Se poate măsura doar la filme."
            : "Filmul rulează la furnizor, care nu ne spune cât s-a văzut.",
      };
    }
    return baza;
  });

  const inainte = useCallback((): void => {
    setErori({});
    if (pas === 2) {
      // Validăm doar cele două câmpuri ale pasului, nu tot materialul: treapta
      // se alege abia la pasul următor, iar o eroare despre ea aici ar arăta ca
      // un refuz fără cauză.
      const doar = creeazaMaterialSchema.safeParse({
        ...sarcina,
        treapta_dovada: "bifa",
        procent_minim: null,
        prag_test: null,
        declaratie_text: "",
      });
      if (!doar.success) {
        const peCamp: Record<string, string[]> = {};
        for (const p of doar.error.issues) {
          const cheie = String(p.path[0] ?? "");
          if (cheie === "cod" || cheie === "titlu" || cheie === "descriere") {
            (peCamp[cheie] ??= []).push(p.message);
          }
        }
        if (Object.keys(peCamp).length > 0) {
          setErori(peCamp);
          return;
        }
      }
    }
    if (pas === 3) {
      // Aici rulează schema ÎNTREAGĂ: orice combinație imposibilă cade acum,
      // înainte să se creeze rândul sau să urce vreun octet.
      const r = creeazaMaterialSchema.safeParse(sarcina);
      if (!r.success) {
        const peCamp: Record<string, string[]> = {};
        for (const p of r.error.issues) {
          (peCamp[String(p.path[0] ?? "")] ??= []).push(p.message);
        }
        setErori(peCamp);
        return;
      }
    }
    setPas((p) => Math.min(ETICHETE_PASI.length, p + 1));
  }, [sarcina, pas]);

  const inapoi = useCallback((): void => {
    setErori({});
    setPas((p) => Math.max(1, p - 1));
  }, []);

  /**
   * Pasul 4. Creează rândul, apoi pune conținutul în el.
   *
   * Ordinea nu e negociabilă: calea din Storage conține `material_id`. La orice
   * eșec de după încărcare, obiectul se scoate din bucket — altfel rămâne acolo
   * pentru totdeauna.
   */
  const salveaza = useCallback((): void => {
    setErori({});
    porneste(async () => {
      setStadiu({ tip: "lucru", mesaj: "Se pregătește materialul…" });
      const creat = await creeazaMaterial(sarcina);
      if (!creat.ok) {
        const peCamp = creat.error.fieldErrors ?? {};
        setErori(peCamp);
        setStadiu({
          tip: "eroare",
          mesaj:
            Object.keys(peCamp).length > 0
              ? "Verificați câmpurile marcate — vă întoarcem la pasul lor."
              : creat.error.message,
        });
        // Codul duplicat e o eroare de la pasul 2; trimitem omul înapoi acolo.
        if (peCamp["cod"] !== undefined || peCamp["titlu"] !== undefined) setPas(2);
        return;
      }
      const idNou = creat.data.id;
      setMaterialId(idNou);

      if (sursa === "link") {
        setStadiu({ tip: "lucru", mesaj: "Se salvează linkul…" });
        const salvat = await salveazaVersiuneLink(
          intrareVersiuneLink(idNou, { adresa, durata, nota: "" }),
        );
        if (!salvat.ok) {
          setErori(salvat.error.fieldErrors ?? {});
          setStadiu({ tip: "eroare", mesaj: salvat.error.message });
          return;
        }
      } else {
        if (fisier === null) {
          setStadiu({ tip: "eroare", mesaj: "Alegeți fișierul." });
          return;
        }
        // A doua verificare, deși `IncarcareFisier` a filtrat deja mărimea și
        // tipul: un fișier tras din altă filă poate avea zero octeți și trece
        // atât de `accept`, cât și de limita de mărime.
        const problema = verificaMaterial(fel, fisier.type, fisier.size);
        if (problema !== null) {
          setStadiu({ tip: "eroare", mesaj: problema });
          return;
        }
        setStadiu({ tip: "lucru", mesaj: "Se pregătește încărcarea…" });
        const pregatire = await pregatesteIncarcareMaterial({
          material_id: idNou,
          fel,
          nume_fisier: fisier.name,
          dimensiune: fisier.size,
          mime: fisier.type,
          este_subtitrare: false,
        });
        if (!pregatire.ok) {
          setStadiu({ tip: "eroare", mesaj: pregatire.error.message });
          return;
        }

        setStadiu({
          tip: "lucru",
          mesaj:
            fel === "video"
              ? "Se încarcă filmul. La o conexiune obișnuită durează câteva minute — nu închideți fila."
              : "Se încarcă documentul…",
        });
        const urcare = await getBrowserSupabase()
          .storage.from(BUCKET_CURSURI)
          .uploadToSignedUrl(pregatire.data.cale, pregatire.data.token, fisier);
        if (urcare.error !== null) {
          setStadiu({ tip: "eroare", mesaj: "Încărcarea a eșuat. Verificați conexiunea." });
          return;
        }

        setStadiu({ tip: "lucru", mesaj: "Se verifică fișierul…" });
        const salvat = await salveazaVersiuneFisier(
          intrareVersiuneFisier(
            {
              materialId: idNou,
              cale: pregatire.data.cale,
              numeFisier: fisier.name,
              mime: fisier.type,
            },
            { durata, numarPagini: "", nota: "" },
          ),
        );
        if (!salvat.ok) {
          await renuntaLaIncarcare({ material_id: idNou, cale: pregatire.data.cale });
          const peCamp = salvat.error.fieldErrors ?? {};
          setErori(peCamp);
          setStadiu({
            tip: "eroare",
            mesaj: Object.values(peCamp).flat().join(" ") || salvat.error.message,
          });
          return;
        }
      }

      setStadiu({ tip: "inactiv" });
      arataToast({ fel: "reusita", text: "Materialul a fost creat." });
      setPas(5);
      router.refresh();
    });
  }, [adresa, durata, fel, fisier, sarcina, router, sursa]);

  const inCurs = stadiu.tip === "lucru";
  const previzualizareLink = adresa.trim() === "" ? null : analizeazaLink(adresa);

  return (
    <div className={`${LATIMI.formular} space-y-6`}>
      <AntetPagina
        titlu="Material nou"
        descriere="Un material e o bucată de conținut refolosibilă: o puteți pune în oricâte cursuri."
        firimituri={[
          { eticheta: "Cursuri", href: "/cursuri" },
          { eticheta: "Bibliotecă", href: "/cursuri/biblioteca" },
          { eticheta: "Material nou" },
        ]}
      />

      <ProgresPasi
        etichete={ETICHETE_PASI}
        pasCurent={pas}
        eticheta="Pașii creării unui material"
        {...(pas < 5
          ? {
              onSalt: (n: number) => {
                if (n < pas) setPas(n);
              },
            }
          : {})}
      />

      {stadiu.tip === "eroare" ? (
        <Callout fel="eroare" titlu="Nu s-a putut salva">
          {stadiu.mesaj}
        </Callout>
      ) : null}

      {/* ── Pasul 1 ─────────────────────────────────────────────────────── */}
      {pas === 1 ? (
        <section aria-labelledby="titlu-pas-1" className="space-y-3">
          <h2 id="titlu-pas-1" className="text-sectiune font-medium">
            Ce fel de material adăugați?
          </h2>
          <AlegereCarduri
            nume="fel"
            eticheta="Felul materialului"
            optiuni={OPTIUNI_FEL}
            valoare={alegere}
            laSchimbare={(v) => {
              setAlegere(v as Fel);
              // Treapta se retrage dacă alegerea o face imposibilă — altfel ar
              // pleca spre server o combinație pe care baza o refuză.
              if (v !== "video_fisier" && treapta === "parcurgere") setTreapta("bifa");
            }}
          />
        </section>
      ) : null}

      {/* ── Pasul 2 ─────────────────────────────────────────────────────── */}
      {pas === 2 ? (
        <section aria-labelledby="titlu-pas-2" className="space-y-4">
          <h2 id="titlu-pas-2" className="text-sectiune font-medium">
            Cum se numește
          </h2>
          <Camp
            nume="titlu"
            id={idc("titlu")}
            eticheta="Titlu"
            obligatoriu
            ajutor="Așa îl vede angajatul în lista lui de cursuri."
            erori={erori["titlu"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={200}
                value={titlu}
                onChange={(e) => {
                  setTitlu(e.target.value);
                }}
              />
            )}
          </Camp>

          <Camp
            nume="cod"
            id={idc("cod")}
            eticheta="Cod"
            obligatoriu
            ajutor="Litere mici, cifre și liniuță jos — fără spații și fără majuscule. Ex.: regulament_intern."
            erori={erori["cod"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={40}
                value={cod}
                onChange={(e) => {
                  setCod(e.target.value);
                }}
              />
            )}
          </Camp>

          <Camp
            nume="descriere"
            id={idc("descriere")}
            eticheta="Descriere"
            fel="textarea"
            erori={erori["descriere"] ?? []}
          >
            {(a) => (
              <textarea
                {...a}
                rows={3}
                maxLength={2000}
                value={descriere}
                onChange={(e) => {
                  setDescriere(e.target.value);
                }}
              />
            )}
          </Camp>
        </section>
      ) : null}

      {/* ── Pasul 3 ─────────────────────────────────────────────────────── */}
      {pas === 3 ? (
        <section aria-labelledby="titlu-pas-3" className="space-y-4">
          <h2 id="titlu-pas-3" className="text-sectiune font-medium">
            Cum se dovedește că a fost parcurs
          </h2>
          <AlegereCarduri
            nume="treapta_dovada"
            eticheta="Treapta de dovadă"
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
              erori={erori["procent_minim"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min={1}
                  max={100}
                  value={procentMinim}
                  onChange={(e) => {
                    setProcentMinim(e.target.value);
                  }}
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
              ajutor="Din 100. Întrebările se scriu după ce încărcați conținutul."
              erori={erori["prag_test"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min={1}
                  max={100}
                  value={pragTest}
                  onChange={(e) => {
                    setPragTest(e.target.value);
                  }}
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
              erori={erori["declaratie_text"] ?? []}
            >
              {(a) => (
                <textarea
                  {...a}
                  rows={3}
                  maxLength={4000}
                  value={declaratieText}
                  onChange={(e) => {
                    setDeclaratieText(e.target.value);
                  }}
                />
              )}
            </Camp>
          ) : null}
        </section>
      ) : null}

      {/* ── Pasul 4 ─────────────────────────────────────────────────────── */}
      {pas === 4 ? (
        <section aria-labelledby="titlu-pas-4" className="space-y-4">
          <h2 id="titlu-pas-4" className="text-sectiune font-medium">
            Conținutul
          </h2>

          <Callout fel="informativ">
            Când apăsați „Salvează materialul”, materialul se creează și conținutul urcă în el. Până
            atunci nu s-a scris nimic.
          </Callout>

          {sursa === "link" ? (
            <>
              <Camp
                nume="adresa"
                id={idc("adresa")}
                eticheta="Adresa filmului"
                obligatoriu
                ajutor="Copiați adresa din bara browserului. YouTube, Vimeo sau Loom."
                erori={erori["adresa"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="url"
                    inputMode="url"
                    maxLength={2048}
                    value={adresa}
                    onChange={(e) => {
                      setAdresa(e.target.value);
                    }}
                  />
                )}
              </Camp>

              {previzualizareLink === null ? null : (
                <Callout fel={previzualizareLink.ok ? "informativ" : "atentie"}>
                  {previzualizareLink.ok
                    ? `Recunoscut: ${ETICHETE_FURNIZOR[previzualizareLink.link.furnizor]} · ${previzualizareLink.link.id}`
                    : previzualizareLink.motiv}
                </Callout>
              )}
            </>
          ) : (
            <IncarcareFisier
              nume="fisier"
              id={idc("fisier")}
              eticheta={fel === "pdf" ? "Document PDF" : "Fișier video"}
              accept={(fel === "pdf" ? MIME_PDF : MIME_VIDEO).join(",")}
              restrictii={RESTRICTII_INCARCARE[fel]}
              textAlegere="Alegeți fișierul"
              etichetaScoate="Scoate fișierul"
              maxOcteti={fel === "pdf" ? LIMITA_PDF_BYTES : LIMITA_VIDEO_BYTES}
              mesajPreaMare={
                fel === "pdf"
                  ? "Fișierul depășește 25 MB."
                  : "Filmul depășește 200 MB. Comprimați-l sau folosiți un link extern."
              }
              obligatoriu
              laSchimbare={setFisier}
            />
          )}

          {fel === "video" ? (
            <Camp
              nume="durata_secunde"
              id={idc("durata_secunde")}
              eticheta="Durata filmului (secunde)"
              obligatoriu={treapta === "parcurgere"}
              ajutor="Se completează aici, nu se citește de la player: altfel numitorul dovezii ar fi ales chiar de cel măsurat."
              erori={erori["durata_secunde"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min={1}
                  max={86400}
                  value={durata}
                  onChange={(e) => {
                    setDurata(e.target.value);
                  }}
                />
              )}
            </Camp>
          ) : null}

          {fel === "video" ? (
            <section aria-labelledby="titlu-transcriere" className="space-y-2">
              <h3 id="titlu-transcriere" className="text-corp font-medium">
                Transcriere
              </h3>
              <p className="text-muted-foreground text-nota">
                Pentru un angajat surd, un film fără transcriere e un curs pe care nu-l poate face —
                și apare ca restanțier pentru un motiv care n-are legătură cu el.
              </p>
              <label className="flex min-h-11 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className={clasaBifa}
                  checked={faraVorbire}
                  onChange={(e) => {
                    setFaraVorbire(e.target.checked);
                  }}
                />
                <span className="text-corp">Filmul nu conține vorbire.</span>
              </label>
              {faraVorbire ? null : (
                <textarea
                  rows={4}
                  maxLength={50000}
                  value={transcriere}
                  placeholder="Lipiți aici textul rostit în film."
                  className={clasaControl({ fel: "textarea" })}
                  onChange={(e) => {
                    setTranscriere(e.target.value);
                  }}
                />
              )}
            </section>
          ) : null}
        </section>
      ) : null}

      {/* ── Pasul 5 ─────────────────────────────────────────────────────── */}
      {pas === 5 ? (
        <section aria-labelledby="titlu-pas-5" className="space-y-4">
          <h2 id="titlu-pas-5" className="text-sectiune flex items-center gap-2 font-medium">
            <CheckCircle2 className="text-success size-5" aria-hidden="true" />
            Materialul e gata
          </h2>

          <ListaDefinitii
            coloane={2}
            textNecompletat="—"
            definitii={[
              { eticheta: "Titlu", valoare: titlu },
              { eticheta: "Cod", valoare: cod, identificator: true },
              {
                eticheta: "Fel",
                valoare: OPTIUNI_FEL.find((o) => o.valoare === alegere)?.eticheta ?? "—",
              },
              { eticheta: "Dovadă", valoare: ETICHETE_TREAPTA[treapta] },
            ]}
          />

          <Callout fel="informativ" titlu="Ce urmează">
            {treapta === "test"
              ? "Scrieți întrebările testului pe pagina materialului, apoi puneți-l într-un curs."
              : "Puneți materialul într-un curs, publicați cursul și atribuiți-l."}
          </Callout>

          <BaraActiuni eticheta="După creare">
            <Buton
              varianta="primar"
              onClick={() => {
                router.push(
                  materialId === null ? "/cursuri/biblioteca" : `/cursuri/biblioteca/${materialId}`,
                );
              }}
            >
              Deschideți materialul
              <ExternalLink className="size-4" aria-hidden="true" />
            </Buton>
            <Buton
              varianta="secundar"
              onClick={() => {
                router.push("/cursuri/biblioteca");
              }}
            >
              Înapoi la bibliotecă
            </Buton>
          </BaraActiuni>
        </section>
      ) : null}

      {/* ── Navigarea ───────────────────────────────────────────────────── */}
      {pas < 5 ? (
        <BaraActiuni eticheta="Navigare în asistent" separata lipitaPeTelefon>
          <Buton varianta="tertiar" disabled={pas === 1 || inCurs} onClick={inapoi}>
            Înapoi
          </Buton>
          {pas < 4 ? (
            <Buton varianta="primar" onClick={inainte}>
              Mai departe
            </Buton>
          ) : (
            <div className="flex flex-col gap-1">
              <Buton
                varianta="primar"
                inCurs={inCurs}
                textInCurs={stadiu.tip === "lucru" ? stadiu.mesaj : "Se salvează…"}
                disabled={inCurs || (sursa === "fisier" ? fisier === null : adresa.trim() === "")}
                onClick={salveaza}
              >
                Salvează materialul
              </Buton>
              {sursa === "fisier" && fisier === null ? (
                <p className="text-muted-foreground text-nota">Alegeți întâi fișierul.</p>
              ) : null}
              {sursa === "link" && adresa.trim() === "" ? (
                <p className="text-muted-foreground text-nota">Lipiți întâi adresa filmului.</p>
              ) : null}
            </div>
          )}
          <Buton
            varianta="link"
            className="ms-auto"
            disabled={inCurs}
            onClick={() => {
              router.push("/cursuri/biblioteca");
            }}
          >
            Renunță
          </Buton>
        </BaraActiuni>
      ) : null}
    </div>
  );
}
