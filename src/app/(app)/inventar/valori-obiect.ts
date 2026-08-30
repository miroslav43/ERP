// src/app/(app)/inventar/valori-obiect.ts

/**
 * `FormData` → încărcătura acțiunilor de obiect de inventar.
 *
 * Cele două formulare — adăugare și modificare — cer EXACT aceleași
 * douăsprezece câmpuri, dar până acum erau scrise de două ori, în două
 * arhitecturi diferite: `nou/formular-obiect.tsx` cu `useTransition` și etichete
 * de mână, `[id]/actiuni-obiect.tsx` cu react-hook-form. Consecința nu era
 * estetică: cel de adăugare nu citea deloc `fieldErrors`, deci mesajul
 * „Garanția nu poate expira înainte de data achiziției.” — care are
 * `path: ["garantie_expira"]` și ajungea pe câmp la modificare — se pierdea la
 * creare într-o singură frază sub buton.
 *
 * ── DE CE `valoare` PLEACĂ CA TEXT, NU CA NUMĂR ───────────────────────────
 * `campuriObiect` (`schemas/inventory.ts:118`) primește deliberat
 * `string | number | null` și face ea trim-ul, regexul și înlocuirea virgulei
 * cu punct. Dacă aș converti aici cu `Number()`, aș pierde exact ramura care
 * acceptă „140,50” — iar `Number("")` e `0`, nu `NaN`, deci un câmp gol ar
 * deveni tăcut un obiect de zero lei. Textul brut e răspunsul corect: schema
 * știe mai multe despre el decât adaptorul.
 *
 * ── DE CE `category_id` GOL DEVINE `null` ─────────────────────────────────
 * `uuidOptional` nu cunoaște șirul gol — `<option value="">Necategorizat</option>`
 * ar fi ajuns la Zod ca „" nu e un UUID valid”, pe un câmp pe care omul l-a
 * lăsat intenționat nealess.
 */
export type ValoriObiect = Readonly<{
  denumire: string;
  numar_inventar: string;
  serie: string | null;
  model: string | null;
  producator: string | null;
  category_id: string | null;
  data_achizitie: string | null;
  valoare: string | null;
  garantie_expira: string | null;
  stare: string;
  locatie: string | null;
  observatii: string | null;
}>;

function text(date: FormData, cheie: string): string {
  return String(date.get(cheie) ?? "").trim();
}

function textSauNull(date: FormData, cheie: string): string | null {
  const valoare = text(date, cheie);
  return valoare.length === 0 ? null : valoare;
}

export function valoriObiect(date: FormData): ValoriObiect {
  return {
    denumire: text(date, "denumire"),
    numar_inventar: text(date, "numar_inventar"),
    serie: textSauNull(date, "serie"),
    model: textSauNull(date, "model"),
    producator: textSauNull(date, "producator"),
    category_id: textSauNull(date, "category_id"),
    data_achizitie: textSauNull(date, "data_achizitie"),
    valoare: textSauNull(date, "valoare"),
    garantie_expira: textSauNull(date, "garantie_expira"),
    /*
      Fără `|| "nou"`: selectorul are mereu o valoare, iar dacă vreodată n-ar
      avea, `z.enum` refuză explicit pe câmp. Un implicit pus aici ar fi
      înlocuit tăcut alegerea omului cu prima din listă.
    */
    stare: text(date, "stare"),
    locatie: textSauNull(date, "locatie"),
    observatii: textSauNull(date, "observatii"),
  };
}
