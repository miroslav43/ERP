// src/lib/asistent/depozit.ts
/**
 * Starea conversației, ținută la nivel de modul.
 *
 * Motivul e cel scris în `toast.tsx` și e regula casei: layout-urile
 * `(app)` și `(portal)` sunt Server Components, iar un provider React le-ar
 * transforma în client, cu tot arborele de deasupra paginilor. Așa,
 * `<ZonaAsistent>` se montează o dată ca frunză, iar starea trăiește lângă ea.
 *
 * Efectul secundar e chiar ce ne trebuie: layout-ul `(app)` NU se re-randează la
 * navigarea din client, deci conversația supraviețuiește mutării dintr-o pagină
 * în alta. Omul întreabă „unde îmi trec orele”, apasă pastila, ajunge pe
 * `/pontaj/saptamana` — iar bula e tot acolo, cu răspunsul încă în ea.
 *
 * ── DE CE STĂ ȘI APELUL DE REȚEA AICI ────────────────────────────────────────
 * Fiindcă răspunsul sosește în bucăți, iar componenta care le afișează n-are de
 * ce să știe ce e un cadru SSE. Depozitul consumă fluxul și publică stare;
 * panoul doar desenează. Bonus: parserul de flux e ACELAȘI fișier folosit de
 * rută (`sse.ts`) — a fost scris pur tocmai ca să meargă în ambele capete.
 */
import type { Destinatie } from "./destinatii";
import { citesteCadru } from "./protocol";
import { creeazaCititorSse } from "./sse";

export type RolAfisat = "om" | "asistent";

export type MesajAfisat = Readonly<{
  id: number;
  rol: RolAfisat;
  text: string;
}>;

export type StareAsistent = Readonly<{
  deschis: boolean;
  mesaje: readonly MesajAfisat[];
  /** Răspunsul e pe drum: se arată rotița și se reține marcajul neterminat. */
  raspunde: boolean;
  /** Numele uneltei care rulează acum, pentru „Caut soldul de concediu…”. */
  unealta: string | null;
  eroare: string | null;
  /** Fișele întoarse de unelte, valabile pentru conversația curentă. */
  efemere: ReadonlyMap<string, Destinatie>;
}>;

const GOL: StareAsistent = {
  deschis: false,
  mesaje: [],
  raspunde: false,
  unealta: null,
  eroare: null,
  efemere: new Map(),
};

let stare: StareAsistent = GOL;
const ascultatori = new Set<(s: StareAsistent) => void>();
let urmatorulId = 1;
let anulare: AbortController | null = null;

function publica(urmatoare: StareAsistent): void {
  stare = urmatoare;
  for (const asculta of ascultatori) asculta(stare);
}

export function stareCurenta(): StareAsistent {
  return stare;
}

export function aboneaza(asculta: (s: StareAsistent) => void): () => void {
  ascultatori.add(asculta);
  return () => {
    ascultatori.delete(asculta);
  };
}

export function comutaAsistent(): void {
  publica({ ...stare, deschis: !stare.deschis });
}

export function inchideAsistent(): void {
  publica({ ...stare, deschis: false });
}

/**
 * Golește conversația și oprește un răspuns în curs.
 *
 * Există pentru butonul „conversație nouă”, dar și pentru deconectare: starea de
 * modul supraviețuiește demontării, iar întrebările unui om n-au ce căuta pe
 * ecranul următorului.
 */
export function reseteazaAsistent(): void {
  anulare?.abort();
  anulare = null;
  publica({ ...GOL, deschis: stare.deschis });
}

const CALE = "/api/asistent";

export async function trimiteIntrebare(intrebare: string, zona: "app" | "portal"): Promise<void> {
  const curatat = intrebare.trim();
  if (curatat === "" || stare.raspunde) return;

  const alOmului: MesajAfisat = { id: urmatorulId++, rol: "om", text: curatat };
  const alAsistentului: MesajAfisat = { id: urmatorulId++, rol: "asistent", text: "" };
  const istoric = [...stare.mesaje, alOmului];

  publica({
    ...stare,
    mesaje: [...istoric, alAsistentului],
    raspunde: true,
    unealta: null,
    eroare: null,
  });

  const adaugaLaRaspuns = (bucata: string): void => {
    publica({
      ...stare,
      mesaje: stare.mesaje.map((mesaj) =>
        mesaj.id === alAsistentului.id ? { ...mesaj, text: mesaj.text + bucata } : mesaj,
      ),
    });
  };

  anulare = new AbortController();
  try {
    const raspuns = await fetch(CALE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        zona,
        // Doar mesajele, fără identificatori: serverul reconstruiește conversația.
        mesaje: istoric.map((mesaj) => ({ rol: mesaj.rol, text: mesaj.text })),
      }),
      signal: anulare.signal,
    });

    if (!raspuns.ok || raspuns.body === null) {
      publica({
        ...stare,
        raspunde: false,
        unealta: null,
        eroare:
          raspuns.status === 429
            ? "Prea multe întrebări. Încearcă peste câteva minute."
            : "Asistentul nu răspunde acum.",
      });
      return;
    }

    await consuma(raspuns.body, adaugaLaRaspuns);
  } catch (eroare) {
    // Anularea deliberată (om a închis panoul) nu e o eroare de arătat.
    const anulat = eroare instanceof DOMException && eroare.name === "AbortError";
    publica({
      ...stare,
      raspunde: false,
      unealta: null,
      eroare: anulat ? null : "Conexiunea a eșuat. Încearcă din nou.",
    });
    return;
  } finally {
    anulare = null;
  }

  publica({ ...stare, raspunde: false, unealta: null });
}

async function consuma(
  corp: ReadableStream<Uint8Array>,
  adaugaLaRaspuns: (bucata: string) => void,
): Promise<void> {
  const cititor = creeazaCititorSse();
  const decodor = new TextDecoder();
  const sursa = corp.getReader();

  for (;;) {
    const { done, value } = await sursa.read();
    const incarcaturi =
      done || value === undefined
        ? cititor.incheie()
        : cititor.adauga(decodor.decode(value, { stream: true }));

    for (const incarcatura of incarcaturi) {
      const cadru = citesteCadru(incarcatura);
      if (cadru === null) continue;
      switch (cadru.t) {
        case "text":
          adaugaLaRaspuns(cadru.b);
          break;
        case "unealta":
          publica({ ...stare, unealta: cadru.n });
          break;
        case "destinatii": {
          const efemere = new Map(stare.efemere);
          for (const destinatie of cadru.d) efemere.set(destinatie.id, destinatie);
          publica({ ...stare, efemere });
          break;
        }
        case "eroare":
          publica({ ...stare, eroare: cadru.m });
          break;
        case "gata":
          publica({ ...stare, raspunde: false, unealta: null });
          break;
      }
    }

    if (done) return;
  }
}
