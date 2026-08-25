"use client";

// src/app/(portal)/portal/cursurile-mele/[id]/[lectieId]/vizualizator-simplu.tsx
// Documentul PDF, filmul extern și declarația asumată — tot ce nu are măsurare
// de parcurgere.

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Play } from "lucide-react";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Camp } from "@/components/ui/camp";
import { ListaDefinitii } from "@/components/ui/lista-definitii";
import { clasaBifa } from "@/components/ui/camp";
import { arataToast } from "@/components/ui/toast";
import { esteFinalizabila, type Lectie } from "@/domain/cursuri/scadente";
import { ETICHETE_FURNIZOR, type FurnizorLink } from "@/lib/media/link-extern";

import { incheieLectie, semneazaLectie } from "../../actions";

interface Proprietati {
  readonly lectieId: string;
  readonly inrolareId: string;
  readonly lectie: Lectie;
  readonly versiuneId: string | null;
  readonly link: Readonly<{ furnizor: FurnizorLink; adresaIncorporare: string; adresaPublica: string }> | null;
  /** Textul declarației. Stă în afara tipului de domeniu: `esteFinalizabila` nu are nevoie de el, doar ecranul. */
  readonly declaratieText: string | null;
  readonly transcriere: string | null;
}

export function VizualizatorSimplu({
  lectieId,
  inrolareId,
  lectie,
  versiuneId,
  link,
  transcriere,
  declaratieText,
}: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [status, setStatus] = useState(lectie.status);
  const [porniteExtern, setPorniteExtern] = useState(false);
  const [nume, setNume] = useState("");
  const [confirmat, setConfirmat] = useState(false);

  const stare: Lectie = { ...lectie, status, semnaturaNume: nume };
  const poate = esteFinalizabila(stare);

  const dupaSucces = useCallback((): void => {
    setStatus("finalizat");
    arataToast({ fel: "reusita", text: "Lecția a fost marcată ca parcursă." });
    router.push(`/portal/cursurile-mele/${inrolareId}`);
    router.refresh();
  }, [inrolareId, router]);

  const incheie = useCallback((): void => {
    setEroare(null);
    porneste(async () => {
      const rezultat = await incheieLectie({ id: lectieId });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      dupaSucces();
    });
  }, [dupaSucces, lectieId]);

  const semneaza = useCallback((): void => {
    setEroare(null);
    porneste(async () => {
      const rezultat = await semneazaLectie({ id: lectieId, nume, confirmare: true });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      dupaSucces();
    });
  }, [dupaSucces, lectieId, nume]);

  return (
    <div className="space-y-4">
      {/* ── Conținutul ────────────────────────────────────────────────── */}
      {link !== null ? (
        porniteExtern ? (
          <div className="border-border rounded-panou aspect-video w-full overflow-hidden border">
            <iframe
              src={link.adresaIncorporare}
              title={lectie.titlu}
              className="size-full"
              // `allow-scripts` + `allow-same-origin` împreună sunt periculoase
              // doar când conținutul e pe ACEEAȘI origine cu gazda. Aici e
              // cross-origin, deci îi dă acces la propriul localStorage, nu la
              // al nostru. Nu se acordă `allow-top-navigation`, `allow-popups`,
              // `allow-forms`, `allow-modals`, `allow-downloads`.
              sandbox="allow-scripts allow-same-origin allow-presentation"
              allow="fullscreen; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              loading="lazy"
            />
          </div>
        ) : (
          /*
            ÎNCĂRCARE LA CLIC, obligatoriu. `youtube-nocookie.com` nu înseamnă
            „fără cookie-uri": transmite furnizorului adresa IP, User-Agent și
            originea la simpla încărcare a iframe-ului. Aici prelucrarea începe
            doar după un gest informat.
          */
          <div className="border-border rounded-panou bg-surface flex aspect-video w-full flex-col items-center justify-center gap-3 border p-6 text-center">
            <Play className="text-muted-foreground size-10" aria-hidden="true" />
            <p className="text-corp">
              Filmul se încarcă de la {ETICHETE_FURNIZOR[link.furnizor]}.{" "}
              {ETICHETE_FURNIZOR[link.furnizor]} va primi adresa dumneavoastră IP.
            </p>
            <Buton
              varianta="primar"
              onClick={() => {
                setPorniteExtern(true);
              }}
            >
              Pornește filmul
            </Buton>
            <a
              href={link.adresaPublica}
              target="_blank"
              rel="noopener noreferrer"
              className="text-nota inline-flex items-center gap-1 underline underline-offset-2"
            >
              Deschideți la sursă
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </div>
        )
      ) : versiuneId === null ? (
        <Callout fel="atentie" titlu="Lecția nu are conținut">
          Materialul nu are încă un fișier încărcat. Anunțați administratorul.
        </Callout>
      ) : (
        <>
          {/*
            `<iframe sandbox="allow-same-origin">` fără `allow-scripts`: PDF-ul
            vine de pe originea NOASTRĂ, cu `Content-Type` forțat de ruta de
            livrare. Nu curățăm PDF-uri — parsarea PDF ca apărare e mai
            periculoasă decât amenințarea; apărarea corectă e izolarea.
          */}
          <iframe
            src={`/api/materiale/${versiuneId}`}
            title={lectie.titlu}
            className="border-border rounded-panou h-[70vh] w-full border"
            sandbox="allow-same-origin"
          />
          <p className="text-nota">
            <a
              href={`/api/materiale/${versiuneId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2"
            >
              Deschideți documentul în filă nouă
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </p>
        </>
      )}

      {transcriere === null ? null : (
        <details className="border-border rounded-panou border p-3">
          <summary className="cursor-pointer font-medium">Transcriere</summary>
          <p className="text-corp mt-2 whitespace-pre-wrap">{transcriere}</p>
        </details>
      )}

      {eroare === null ? null : (
        <Callout fel="eroare" titlu="Nu s-a putut înregistra">
          {eroare}
        </Callout>
      )}

      {/* ── Încheierea ────────────────────────────────────────────────── */}
      {status === "finalizat" ? (
        <Callout fel="informativ" titlu="Ați parcurs această lecție">
          O puteți revedea oricând.
        </Callout>
      ) : lectie.treaptaDovada === "declaratie" ? (
        <section aria-labelledby="titlu-declaratie" className="border-border rounded-panou space-y-3 border p-4">
          <h2 id="titlu-declaratie" className="text-sectiune font-medium">
            Declarație
          </h2>
          <p className="text-corp">{declaratieText ?? ""}</p>

          {/* Ce se înregistrează e VIZIBIL înainte de semnare, nu ascuns într-o
              politică de confidențialitate. */}
          <ListaDefinitii
            coloane={1}
            textNecompletat="—"
            definitii={[
              { eticheta: "Se înregistrează", valoare: "numele scris de dumneavoastră" },
              { eticheta: "", valoare: "data și ora semnării" },
              { eticheta: "", valoare: "adresa IP de la care semnați" },
              { eticheta: "", valoare: "versiunea exactă a materialului" },
            ]}
          />

          <Camp nume="nume" eticheta="Numele dumneavoastră complet" obligatoriu>
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={160}
                value={nume}
                onChange={(e) => {
                  setNume(e.target.value);
                }}
              />
            )}
          </Camp>

          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              className={clasaBifa}
              checked={confirmat}
              onChange={(e) => {
                setConfirmat(e.target.checked);
              }}
            />
            <span className="text-corp">Confirm că am citit și am înțeles.</span>
          </label>

          <BaraActiuni eticheta="Semnarea declarației" lipitaPeTelefon>
            <div className="flex flex-col gap-1">
              <Buton
                varianta="primar"
                disabled={!poate.poate || !confirmat || inCurs}
                inCurs={inCurs}
                textInCurs="Se semnează…"
                onClick={semneaza}
              >
                Semnez declarația
              </Buton>
              {poate.poate && confirmat ? null : (
                <p className="text-muted-foreground text-nota">
                  {poate.poate ? "Bifați confirmarea pentru a semna." : poate.motiv}
                </p>
              )}
            </div>
          </BaraActiuni>
        </section>
      ) : (
        <BaraActiuni eticheta="Încheierea lecției" lipitaPeTelefon>
          <div className="flex flex-col gap-1">
            <Buton
              varianta="primar"
              disabled={!poate.poate || inCurs}
              inCurs={inCurs}
              textInCurs="Se înregistrează…"
              onClick={incheie}
            >
              Am parcurs lecția
            </Buton>
            {poate.poate ? null : <p className="text-muted-foreground text-nota">{poate.motiv}</p>}
          </div>
        </BaraActiuni>
      )}
    </div>
  );
}
