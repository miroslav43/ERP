import { formatDate } from "@/lib/format/date";
import { LINIE_GOALA, type DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { aziIso, construiesteCerere, normalizeazaData, normalizeazaText, plusZile } from "./cerere";

/**
 * Cererea de concediu ca `DocumentTabelar`, pentru Word și PDF, în trei variante.
 *
 * ── DE CE „EVENIMENT” NU SCRIE NUMĂRUL DE ZILE ─────────────────────────────
 * Art. 152 alin. (2) din Codul muncii trimite numărul zilelor libere plătite la
 * lege, la contractul colectiv aplicabil sau la regulamentul intern. Listele cu
 * „5 zile la căsătorie” care circulă vin din HG 250/1992, aplicabilă sectorului
 * bugetar. O cifră scrisă de noi ar ajunge semnată de om, în firma lui, unde
 * poate fi alta. Textul de lege verificat pe forma consolidată la 2 oct 2026.
 */

export type TipCerere = "odihna" | "fara-plata" | "eveniment";

export function normalizeazaTip(brut: string | null): TipCerere {
  return brut === "fara-plata" || brut === "eveniment" ? brut : "odihna";
}

export type OptiuniCerere = Readonly<{
  tip: TipCerere;
  salariat: string;
  functie: string;
  angajator: string;
  localitate: string;
  deLa: string;
  panaLa: string;
  dataCererii: string;
  motiv: string;
}>;

const TITLU: Readonly<Record<TipCerere, string>> = {
  odihna: "Cerere de concediu de odihnă",
  "fara-plata": "Cerere de concediu fără plată",
  eveniment: "Cerere de zile libere pentru un eveniment familial",
};

const sau = (valoare: string) => (valoare === "" ? LINIE_GOALA : valoare);

export function cerereCaDocument(o: OptiuniCerere): DocumentTabelar {
  const cine = `Subsemnatul/Subsemnata ${sau(o.salariat)}, având funcția de ${sau(o.functie)}`;
  const perioada = `${formatDate(o.deLa)} – ${formatDate(o.panaLa)} inclusiv`;
  const paragrafe: string[] = [];
  const note: string[] = [];

  if (o.tip === "odihna") {
    const c = construiesteCerere(o.deLa, o.panaLa);
    const zile = c.zileLucratoare === 1 ? "zi lucrătoare" : "zile lucrătoare";
    paragrafe.push(
      `${cine}, vă rog să binevoiți a aproba efectuarea concediului de odihnă în perioada ${perioada}, reprezentând ${String(c.zileLucratoare)} ${zile}.`,
    );
    const sarbatori =
      c.excluse.length > 0
        ? ` și nici sărbătorile legale: ${c.excluse.map((z) => `${formatDate(z.data)} (${z.motiv})`).join(", ")}`
        : "";
    paragrafe.push(
      `Menționez că în intervalul solicitat nu se numără ${c.zileWeekend > 0 ? `cele ${String(c.zileWeekend)} zile de weekend` : "nicio zi de weekend"}${sarbatori}.`,
    );
    note.push(
      "Sărbătorile legale în care nu se lucrează nu sunt incluse în durata concediului de odihnă — art. 145 alin. (3) din Codul muncii.",
    );
  } else if (o.tip === "fara-plata") {
    paragrafe.push(
      `${cine}, vă rog să binevoiți a aproba efectuarea unui concediu fără plată, pentru rezolvarea unor situații personale, în perioada ${perioada}.`,
    );
    note.push(
      "Salariații au dreptul la concedii fără plată pentru rezolvarea unor situații personale; durata se stabilește prin contractul colectiv aplicabil sau prin regulamentul intern — art. 153 din Codul muncii.",
    );
  } else {
    paragrafe.push(
      `${cine}, vă rog să binevoiți a aproba acordarea zilelor libere plătite cuvenite pentru ${sau(o.motiv)}, în perioada ${perioada}.`,
    );
    note.push(
      "Evenimentele familiale deosebite și numărul zilelor libere plătite se stabilesc prin lege, prin contractul colectiv aplicabil sau prin regulamentul intern — art. 152 din Codul muncii. Zilele acestea nu se includ în concediul de odihnă.",
    );
  }

  return {
    titlu: TITLU[o.tip],
    subtitlu: o.angajator === "" ? null : `Către: ${o.angajator}`,
    campuri: [],
    paragrafe,
    coloane: [],
    randuri: [],
    umbrite: [],
    note: [`${sau(o.localitate)}, ${formatDate(o.dataCererii)}`, ...note],
    semnaturi: ["Semnătura salariatului", "Șef ierarhic", "Aprobat"],
    orientare: "portret",
    numeFisier: `cerere-${o.tip}-${o.deLa}`,
  };
}

/** Aceiași parametri ca formularul paginii: `de_la`, `pana_la`, `salariat`… */
export function cerereDinParametri(q: URLSearchParams): DocumentTabelar {
  const azi = aziIso();
  const val = (cheie: string) => q.get(cheie) ?? undefined;
  return cerereCaDocument({
    tip: normalizeazaTip(q.get("tip")),
    salariat: normalizeazaText(val("salariat")),
    functie: normalizeazaText(val("functie"), 80),
    angajator: normalizeazaText(val("angajator")),
    localitate: normalizeazaText(val("localitate"), 60),
    deLa: normalizeazaData(val("de_la"), plusZile(azi, 30)),
    panaLa: normalizeazaData(val("pana_la"), plusZile(azi, 36)),
    dataCererii: normalizeazaData(val("data"), azi),
    motiv: normalizeazaText(val("motiv"), 80),
  });
}
