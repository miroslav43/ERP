// src/app/(marketing)/_componente/imagine-distribuire.tsx
import { ImageResponse } from "next/og";

import { SIGLA_CALE, SIGLA_CULOARE, SIGLA_INALTIME, SIGLA_LATIME } from "@/components/sigla";

import { IMAGINE_DISTRIBUIRE } from "./metadate";

const size = { width: IMAGINE_DISTRIBUIRE.width, height: IMAGINE_DISTRIBUIRE.height };

/**
 * Imaginea de distribuire, servită de `imagine-distribuire.png/route.ts`.
 *
 * Până pe 2 oct 2026 stătea în `opengraph-image.tsx`; de ce s-a mutat, în
 * comentariul lui `IMAGINE_DISTRIBUIRE` din `metadate.ts`.
 *
 * Fontul se aduce explicit, nu se lasă pe seama celui implicit al generatorului:
 * textul conține ș și ț cu virgulă dedesubt, iar dacă familia de rezervă nu le
 * are, în locul lor apar pătrate — exact în singurul artefact al proiectului pe
 * care îl vede cineva înainte să deschidă site-ul.
 *
 * Google servește TTF simplu doar către agenți foarte vechi; către unul modern
 * ar da woff2, pe care generatorul nu îl citește. De aici agentul de mai jos.
 * Dacă aducerea eșuează (integrare continuă fără rețea), imaginea se randează
 * cu fontul implicit în loc să cadă build-ul.
 */
const UA_TTF = "Mozilla/5.0 (Linux; U; Android 2.2; en-us)";
const CSS_FIRA =
  "https://fonts.googleapis.com/css2?family=Fira+Sans+Condensed:wght@600&display=swap&subset=latin-ext";

async function adaFira(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(CSS_FIRA, { headers: { "User-Agent": UA_TTF } }).then((r) => r.text());
    const url = /url\((https:[^)]+)\)/.exec(css)?.[1];
    if (url === undefined) return null;
    const raspuns = await fetch(url);
    if (!raspuns.ok) return null;
    return await raspuns.arrayBuffer();
  } catch {
    return null;
  }
}

const HARTIE = "#ECEFEC";
const CERNEALA = "#0E1C21";
const SLAB = "#4A5A5E";

export async function deseneazaImagineDistribuire(): Promise<ImageResponse> {
  const font = await adaFira();

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: HARTIE,
        color: CERNEALA,
        fontFamily: font === null ? "sans-serif" : "Fira Sans Condensed",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "64px 72px 0 72px",
        }}
      >
        {/*
          Sigla din `docs/comercial/sigla/`, aceeași ca în antetul sitului (7 oct
          2026). Lățimea se calculează din raportul siglei, ca literele să nu se
          deformeze.
        */}
        <svg
          width={Math.round((32 * SIGLA_LATIME) / SIGLA_INALTIME)}
          height={32}
          viewBox={`0 0 ${String(SIGLA_LATIME)} ${String(SIGLA_INALTIME)}`}
        >
          <path d={SIGLA_CALE} fill={SIGLA_CULOARE} />
        </svg>

        <div
          style={{
            display: "flex",
            fontSize: 78,
            lineHeight: 1.02,
            letterSpacing: "-0.022em",
            marginTop: 72,
            // Aceeași rupere ca titlul paginii de start: trei rânduri, fără „Excel.” singur.
            maxWidth: 780,
          }}
        >
          Angajații se pontează de pe telefon. Tu{"\u00a0"}închizi luna fără Excel.
        </div>

        <div style={{ display: "flex", fontSize: 27, color: SLAB, marginTop: 34 }}>
          Program de pontaj și HR pentru firme cu 5–50 de angajați
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
          backgroundColor: CERNEALA,
          color: HARTIE,
          padding: "30px 72px",
          fontSize: 25,
        }}
      >
        <span style={{ fontSize: 19, letterSpacing: "0.14em" }}>MODULE</span>
        <span>Pontaj · Concedii · REGES-ONLINE · Salarizare · SSM și PSI · Parc auto</span>
      </div>
    </div>,
    // `exactOptionalPropertyTypes` e activ: cheia `fonts` nu are voie să existe
    // cu valoarea `undefined`, deci se adaugă doar când chiar avem fontul.
    font === null
      ? { ...size }
      : {
          ...size,
          fonts: [
            {
              name: "Fira Sans Condensed",
              data: font,
              weight: 600 as const,
              style: "normal" as const,
            },
          ],
        },
  );
}
