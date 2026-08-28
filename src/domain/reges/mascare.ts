// src/domain/reges/mascare.ts
//
// Curăță textele care ajung în bază sau în jurnal de date personale.
//
// Cerința era „logging cu mascarea datelor sensibile". Pentru corpurile
// cererilor, răspunsul e mai simplu decât mascarea: nu se stochează deloc — o
// cerere `Salariat` ESTE, în întregime, dată personală. Rămâne însă un loc unde
// text străin intră la noi fără să-l fi compus noi: mesajele de eroare întoarse
// de REGES. Un „CNP-ul 1900101070016 este deja înregistrat" e exact genul de
// explicație utilă care nu are ce căuta în `reges_mesaje.rezultat_mesaj`.

const CNP = /\b[1-8]\d{12}\b/g;
const IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;

// NU se maschează seria și numărul actului de identitate. Am încercat cu
// `/\b[A-Z]{2,3}\s?\d{6,9}\b/`, iar testul a arătat imediat de ce nu merge:
// tiparul înghite „COR 251401", „CAEN 6201" și orice număr de contract cu prefix
// literal. Un mascator care ascunde codul COR dintr-un mesaj de refuz lasă
// operatorul fără nicio informație despre ce a greșit — adică exact opusul
// scopului jurnalului. CNP-ul și IBAN-ul au forme suficient de strânse ca să nu
// dea fals pozitiv; seria de act nu are.

/**
 * Înlocuiește datele personale recunoscute cu ultimele patru caractere.
 *
 * Nu pretinde exhaustivitate — un nume propriu rămâne nemascabil fără un
 * dicționar — dar acoperă identificatorii care se pot corela înapoi la o
 * persoană, adică exact ce interzice regulamentul.
 */
export function mascheazaText(valoare: string | null | undefined): string | null {
  if (valoare === null || valoare === undefined) return null;
  const curat = valoare
    .replace(CNP, (m) => `*********${m.slice(-4)}`)
    .replace(IBAN, (m) => `${m.slice(0, 4)}****${m.slice(-4)}`);
  // Plafon: un mesaj de eroare de 40 KB nu ajută pe nimeni și umple tabela.
  return curat.length > 2000 ? `${curat.slice(0, 2000)}…` : curat;
}

/** Ultimele patru cifre ale CNP-ului, pentru afișare. */
export function ultimele4(cnp: string | null | undefined): string | null {
  if (cnp === null || cnp === undefined) return null;
  const cifre = cnp.replace(/\D/g, "");
  return cifre.length >= 4 ? cifre.slice(-4) : null;
}
