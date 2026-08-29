// src/domain/hr/stergere-angajat.ts
// Ce ține o fișă de angajat pe loc, și cum se spune asta în cuvinte.

/**
 * Cele trei piedici la ștergerea unei fișe, NUMĂRATE, nu doar „da/nu”.
 *
 * Cifra e ce transformă refuzul în instrucțiune: „are contract activ” lasă omul
 * să se întrebe care, „are 2 contracte de muncă active” îi spune unde să se
 * ducă. Același argument ca la `actiuni-functie.tsx`, unde numărul de angajați
 * alocați stă lângă butonul de dezactivare.
 */
export type PiediciStergere = Readonly<{
  /** Contracte cu `status = 'activ'`, nescrise-șterse. */
  contracteActive: number;
  /** Angajați care îl au ca `manager_employee_id` direct. */
  subordonatiDirecti: number;
  /** Fișa e legată de contul care cere ștergerea. */
  esteFisaProprie: boolean;
}>;

/**
 * Acordul numeralului în română: 1 contract · 3 contracte · 25 DE contracte.
 * Regula „de” peste 19 nu e cosmetică — „25 contracte” se citește ca o greșeală
 * de tipar, iar mesajul care refuză o operațiune n-are voie să pară stricat.
 */
function numara(n: number, singular: string, plural: string): string {
  if (n === 1) return `un ${singular}`;
  return n % 100 > 19 || n % 100 === 0 ? `${String(n)} de ${plural}` : `${String(n)} ${plural}`;
}

/**
 * Motivele refuzului, TOATE, în ordinea în care se rezolvă.
 *
 * ── DE CE TOATE, NU PRIMUL ────────────────────────────────────────────────
 * Un refuz care se oprește la prima piedică obligă omul la o serie de
 * încercări: încetează contractul, mai apasă o dată, află că are și
 * subordonați, mută subordonații, mai apasă o dată. Fiecare pas costă o
 * navigare și o repetare a confirmării. Lista completă se citește o dată.
 *
 * Ordinea urmează efortul: contractul se încetează dintr-un buton aflat pe
 * aceeași pagină, subordonații cer câte o editare de fișă, iar fișa proprie nu
 * se rezolvă deloc din ecranul ăsta — de aceea e ultima.
 */
export function motiveleRefuzuluiStergerii(piedici: PiediciStergere): readonly string[] {
  const motive: string[] = [];

  if (piedici.contracteActive > 0) {
    motive.push(
      `are ${numara(piedici.contracteActive, "contract de muncă activ", "contracte de muncă active")} — încetează-l întâi, altfel fișa iese din evidență cu contractul viu în REGES`,
    );
  }

  if (piedici.subordonatiDirecti > 0) {
    motive.push(
      `este manager pentru ${numara(piedici.subordonatiDirecti, "angajat", "angajați")} — mută-i pe alt manager, altfel lanțul din organigramă rămâne rupt`,
    );
  }

  if (piedici.esteFisaProprie) {
    motive.push("este fișa contului cu care ești autentificat acum");
  }

  return motive;
}

/**
 * Propoziția gata de afișat, sau `null` când nu există nicio piedică.
 *
 * Aceeași funcție hrănește ecranul (unde apare sub butonul blocat) și Server
 * Action-ul (unde devine mesajul de eroare). Dacă ar fi două texte, ele s-ar
 * despărți la primul fix făcut într-un singur loc — și atunci butonul ar spune
 * un motiv, iar serverul altul.
 */
export function mesajRefuzStergere(piedici: PiediciStergere): string | null {
  const motive = motiveleRefuzuluiStergerii(piedici);
  if (motive.length === 0) return null;
  return `Nu se poate șterge fișa, pentru că ${motive.join("; ")}.`;
}
