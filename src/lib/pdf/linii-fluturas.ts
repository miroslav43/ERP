// src/lib/pdf/linii-fluturas.ts
// Traducerea unui rând `payroll_entries` în liniile fluturașului.
//
// Fișier separat de generatorul PDF, și fără `server-only`, ca să poată fi
// TESTAT: e singurul loc unde se decide ce apare pe documentul pe care
// angajatul îl primește pe e-mail. O linie omisă aici nu produce nicio eroare —
// doar un fluturaș din care lipsește un câștig.
//
// Etichetele oglindesc `src/components/payroll/fluturas.tsx`: ecranul și PDF-ul
// trebuie să spună aceleași cuvinte, altfel angajatul crede că sunt două
// calcule diferite.
import type { LinieFluturas } from "./fluturas";

/** Doar câmpurile de care depinde fluturașul — nu tot `DetaliuInregistrare`. */
export interface SursaFluturas {
  readonly baza_salariu: number;
  readonly suma_ore_suplimentare: number;
  readonly spor_noapte: number;
  readonly prime_total: number;
  readonly valoare_tichete: number;
  readonly brut: number;
  readonly cas: number;
  readonly cass: number;
  readonly deducere_personala: number;
  readonly scutire_fiscala: number;
  readonly impozit: number;
  readonly net: number;
  readonly retineri_total: number;
  readonly net_de_plata: number;
}

/** Se ascund liniile nule: un fluturaș cu opt „0,00 lei" nu se citește. */
const nenul = (linie: LinieFluturas): boolean => linie.valoare !== 0 || linie.total === true;

export function castigurileFluturasului(sursa: SursaFluturas): readonly LinieFluturas[] {
  return [
    { eticheta: "Salariu de bază (după zilele lucrate)", valoare: sursa.baza_salariu },
    { eticheta: "Ore suplimentare", valoare: sursa.suma_ore_suplimentare },
    { eticheta: "Spor de noapte", valoare: sursa.spor_noapte },
    { eticheta: "Prime și sporuri", valoare: sursa.prime_total },
    { eticheta: "Venit brut", valoare: sursa.brut, total: true },
    // Tichetele NU intră în brut — se acordă separat, pe zilele efectiv
    // lucrate — dar apar aici fiindcă angajatul le primește. Contribuțiile pe
    // ele, când se aplică, sunt deja incluse în CASS și impozit mai jos.
    { eticheta: "Tichete de masă (acordate separat)", valoare: sursa.valoare_tichete },
  ].filter(nenul);
}

export function retinerileFluturasului(sursa: SursaFluturas): readonly LinieFluturas[] {
  return [
    { eticheta: "CAS — contribuția la pensie", valoare: sursa.cas, scade: true },
    { eticheta: "CASS — contribuția la sănătate", valoare: sursa.cass, scade: true },
    { eticheta: "Deducere personală", valoare: sursa.deducere_personala },
    { eticheta: "Scutire fiscală", valoare: sursa.scutire_fiscala },
    { eticheta: "Impozit pe venit", valoare: sursa.impozit, scade: true },
    { eticheta: "Salariu net", valoare: sursa.net, total: true },
    { eticheta: "Rețineri (avans, popriri, rate)", valoare: sursa.retineri_total, scade: true },
    { eticheta: "Net de plată", valoare: sursa.net_de_plata, total: true },
  ].filter(nenul);
}
