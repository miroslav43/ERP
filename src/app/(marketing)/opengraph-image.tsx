import { ImageResponse } from "next/og";

export const alt = "Administrativo — pontaj, concedii și salarizare pentru firme din România";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Imaginea de distribuire.
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

export default async function Imagine() {
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
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* Marca: coloana de ore care se închide pe linia de total. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 34 }}>
              {[16, 30, 12, 22].map((h) => (
                <div key={h} style={{ width: 7, height: h, backgroundColor: CERNEALA }} />
              ))}
            </div>
            <div style={{ width: 40, height: 5, backgroundColor: CERNEALA }} />
          </div>
          <div style={{ fontSize: 38, letterSpacing: "-0.01em" }}>Administrativo</div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 78,
            lineHeight: 1.02,
            letterSpacing: "-0.022em",
            marginTop: 72,
            maxWidth: 940,
          }}
        >
          Firma ta are deja procedurile. Administrativo le ține minte.
        </div>

        <div style={{ display: "flex", fontSize: 27, color: SLAB, marginTop: 34 }}>
          ERP și HR pentru firme din România
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
        <span>Pontaj · Concedii · Salarizare · SSM și PSI · Parc auto · Inventar</span>
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
