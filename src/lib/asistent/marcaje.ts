// src/lib/asistent/marcaje.ts
/**
 * Traduce `[[ruta:pontaj.saptamana]]` din textul modelului într-o destinație
 * reală — sau în nimic.
 *
 * Aici se închide bucla începută în `destinatii.ts`. Modelul scrie un
 * identificator; funcția asta îl caută în indexul închis. Ce se întâmplă când
 * nu-l găsește e întreaga poantă: marcajul DISPARE, tăcut. Nu se randează ca
 * text brut (omul ar vedea o paranteză dublă ciudată), nu devine un link mort,
 * nu produce o eroare care oprește răspunsul. Cel mai rău rezultat posibil al
 * unei halucinații e o frază fără pastilă lângă ea.
 *
 * ── DE CE `inCurs` ───────────────────────────────────────────────────────────
 * Textul sosește în bucăți, deci la o randare intermediară șirul se poate opri
 * la `Deschide [[ruta:ponta`. Fără tratament, omul ar vedea gunoiul ăsta pe
 * ecran o zecime de secundă, la fiecare referință. Cu `inCurs = true`, un
 * marcaj neterminat de la coada textului se reține până sosește restul.
 *
 * Reținerea se face DOAR la coadă: un `[[` rămas orfan în mijlocul textului (o
 * paranteză dublă scrisă de model din alte motive) nu blochează nimic, fiindcă
 * după el mai vine text.
 */
import { destinatiaDupaId, type Destinatie } from "./destinatii";

export type Segment =
  Readonly<{ tip: "text"; text: string }> | Readonly<{ tip: "ruta"; destinatie: Destinatie }>;

/**
 * PERMISIV la potrivire, STRICT la rezolvare — și asta e o decizie, nu o
 * scăpare.
 *
 * Identificatorii legitimi sunt `familie.subpagina`: litere mici, cifre, punct,
 * cratimă. Tentația e să scrii clasa asta în regex. Consecința ar fi că un
 * `[[ruta:MAJUSCULE]]` sau un `[[ruta:]]` scris greșit de model NU s-ar potrivi,
 * deci ar ajunge NERANDAT pe ecran, ca text brut, cu paranteze duble cu tot.
 * Adică exact ce nu vrem: mecanismul intern al asistentului, expus omului.
 *
 * Așa că marcajul înghite orice, mai puțin `]` și rândul nou (ca o paranteză
 * neînchisă să nu poată mânca tot restul răspunsului), iar filtrul adevărat e
 * căutarea în index de mai jos: ce nu se rezolvă, dispare.
 */
const MARCAJ = /\[\[ruta:([^\]\n]*)\]\]/g;

/**
 * Orice PREFIX al unui marcaj complet, ancorat la coada textului.
 *
 * Enumerarea explicită — `[`, `[[`, `[[r`, …, `[[ruta:abc`, `[[ruta:abc]` —
 * pare greoaie, dar e singura care nu reține din greșeală text obișnuit: un
 * `vezi [1]` la coada frazei nu e început de marcaj și nu are voie să clipească.
 */
const MARCAJ_TRUNCHIAT = /\[(?:\[(?:r(?:u(?:t(?:a(?::[^\]\n]*\]?)?)?)?)?)?)?$/;

export type OptiuniImpartire = Readonly<{
  /** Răspunsul încă sosește: un marcaj neterminat de la coadă se reține. */
  inCurs?: boolean;
  /**
   * Destinații valabile DOAR în răspunsul curent, produse de unelte.
   *
   * Indexul static nu poate conține fișa lui Ion Popescu — sunt tot atâtea rute
   * câți angajați, iar identificatorii lor nu există până nu întreabă cineva.
   * Uneltele care întorc entități înregistrează aici destinații efemere, cu
   * `id` de forma `fisa.<uuid>`.
   *
   * Mulțimea rămâne închisă, doar că e închisă prin PROVENIENȚĂ, nu prin
   * enumerare: singurele fișe care ajung aici sunt cele întoarse de o citire pe
   * care omul avea dreptul să o facă, sub RLS, în chiar cererea asta. Un UUID
   * inventat de model nu e în hartă, deci marcajul dispare — iar dacă printr-o
   * minune ar nimeri unul real, pagina își verifică oricum permisiunea.
   */
  extra?: ReadonlyMap<string, Destinatie>;
}>;

export function imparteRaspuns(text: string, optiuni: OptiuniImpartire = {}): readonly Segment[] {
  const { inCurs = false, extra } = optiuni;
  let deLucru = text;
  if (inCurs) {
    const trunchiat = MARCAJ_TRUNCHIAT.exec(deLucru);
    if (trunchiat !== null) deLucru = deLucru.slice(0, trunchiat.index);
  }

  const segmente: Segment[] = [];
  let pozitie = 0;

  // `matchAll` pe un regex global e reentrant, spre deosebire de `exec` în
  // buclă, care ar păstra `lastIndex` între apeluri ale funcției.
  for (const potrivire of deLucru.matchAll(MARCAJ)) {
    const id = potrivire[1];
    if (id === undefined) continue;
    const inainte = deLucru.slice(pozitie, potrivire.index);
    pozitie = potrivire.index + potrivire[0].length;

    const destinatie = extra?.get(id) ?? destinatiaDupaId(id);
    if (destinatie === undefined) {
      // Identificator inventat. Textul dinaintea lui se păstrează — fraza e
      // bună, doar pastila lipsește.
      adaugaText(segmente, inainte);
      continue;
    }
    adaugaText(segmente, inainte);
    segmente.push({ tip: "ruta", destinatie });
  }

  adaugaText(segmente, deLucru.slice(pozitie));
  return segmente;
}

function adaugaText(segmente: Segment[], text: string): void {
  if (text === "") return;
  const ultim = segmente.at(-1);
  // Un marcaj aruncat din mijlocul frazei ar tăia textul în două bucăți lipite;
  // reunite, ca randarea de markdown să vadă un paragraf, nu două.
  if (ultim !== undefined && ultim.tip === "text") {
    segmente[segmente.length - 1] = { tip: "text", text: ultim.text + text };
    return;
  }
  segmente.push({ tip: "text", text });
}

/** Destinațiile la care trimite răspunsul, în ordine, fără repetări. */
export function ruteleDinRaspuns(
  text: string,
  extra?: ReadonlyMap<string, Destinatie>,
): readonly Destinatie[] {
  const vazute = new Set<string>();
  const iesire: Destinatie[] = [];
  for (const segment of imparteRaspuns(text, extra === undefined ? {} : { extra })) {
    if (segment.tip !== "ruta") continue;
    if (vazute.has(segment.destinatie.id)) continue;
    vazute.add(segment.destinatie.id);
    iesire.push(segment.destinatie);
  }
  return iesire;
}
