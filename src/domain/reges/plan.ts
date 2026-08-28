// src/domain/reges/plan.ts
//
// Un eveniment legal → lista ORDONATĂ de mesaje REGES, cu dependențele lor.
//
// PARTEA CARE SE STRICĂ TĂCUT
// O angajare nouă nu e un mesaj, ci două: `InregistrareSalariat`, apoi
// `AdaugareContract`. Al doilea cere `continut.referintaSalariat.id` — un UUID
// pe care îl aflăm abia din rezultatul ASINCRON al primului. Nu e o chestiune de
// ordine în coadă: al doilea mesaj nu poate fi nici măcar CONSTRUIT până nu
// sosește răspunsul la primul.
//
// Un cod care le trimite pe amândouă odată nu dă nicio eroare la noi. Primește
// două recipise, iar al doilea mesaj e refuzat asincron cu „referință
// inexistentă" — la ore după ce operatorul a plecat, pe un termen legal care
// curge. De aceea planul de mai jos întoarce `depindeDePrecedentul`, iar coada
// refuză să trimită un mesaj a cărui dependență n-are încă `referinta_id`.
//
// Modulul e PUR: nu știe nimic despre bază. Decide ce mesaje sunt necesare
// pornind de la ce identificatori REGES există deja.

import type { Operatie } from "./operatii";

/** Tipurile de eveniment din registru, în oglindă cu enum-ul `reges_tip_eveniment`. */
export type TipEveniment =
  | "angajare"
  | "modificare_salariu"
  | "modificare_functie"
  | "modificare_norma"
  | "modificare_durata"
  | "suspendare"
  | "reluare_activitate"
  | "detasare"
  | "incetare"
  | "corectie";

export type PasPlan = Readonly<{
  tip: "salariat" | "contract" | "propunere_detasare" | "propunere_mutare";
  operatie: Operatie;
  ordine: number;
  /**
   * Pasul are nevoie de `referinta_id` produsă de pasul precedent din listă.
   * Se traduce în coloana `reges_mesaje.depinde_de`.
   */
  depindeDePrecedentul: boolean;
  /** De ce există pasul — text pentru ecranul de coadă, nu pentru API. */
  explicatie: string;
}>;

export type StarePentruPlan = Readonly<{
  tipEveniment: TipEveniment;
  /** `employees.reges_salariat_id`. `null` = salariatul nu e încă la ITM. */
  regesSalariatId: string | null;
  /** `employment_contracts.reges_contract_id`. */
  regesContractId: string | null;
}>;

export type Rezultat<T> =
  Readonly<{ ok: true; valoare: T }> | Readonly<{ ok: false; motiv: string }>;

const PAS_SALARIAT: Omit<PasPlan, "ordine" | "depindeDePrecedentul"> = {
  tip: "salariat",
  operatie: "InregistrareSalariat",
  explicatie: "Salariatul nu are încă identificator REGES: se înregistrează întâi persoana.",
};

/** Ce operație de contract cere fiecare tip de eveniment. */
const OPERATIE_DUPA_EVENIMENT: Readonly<Partial<Record<TipEveniment, Operatie>>> = {
  angajare: "AdaugareContract",
  modificare_salariu: "ModificareContract",
  modificare_functie: "ModificareContract",
  modificare_norma: "ModificareContract",
  modificare_durata: "ModificareContract",
  corectie: "ModificareContract",
  suspendare: "SuspendareContract",
  reluare_activitate: "ReactivareContract",
  incetare: "IncetareContract",
  detasare: "PropunereDetasareContract",
};

/**
 * Construiește lista de mesaje pentru un eveniment.
 *
 * Întoarce `Rezultat` în loc să arunce: un eveniment care nu poate fi tradus în
 * mesaje e o stare de date, nu un defect de program, și trebuie să ajungă în
 * ecranul HR-ului cu motivul scris.
 */
export function planificaMesaje(stare: StarePentruPlan): Rezultat<readonly PasPlan[]> {
  const operatie = OPERATIE_DUPA_EVENIMENT[stare.tipEveniment];
  if (operatie === undefined) {
    return {
      ok: false,
      motiv: `Evenimentul „${stare.tipEveniment}" nu are corespondent în operațiile REGES.`,
    };
  }

  const pasi: PasPlan[] = [];

  // Salariatul se înregistrează O SINGURĂ DATĂ. A doua `InregistrareSalariat`
  // pentru același CNP e respinsă ca duplicat, iar refuzul vine asincron.
  if (stare.regesSalariatId === null) {
    pasi.push({ ...PAS_SALARIAT, ordine: 0, depindeDePrecedentul: false });
  }

  const cereContractExistent = operatie !== "AdaugareContract";
  if (cereContractExistent && stare.regesContractId === null) {
    return {
      ok: false,
      motiv:
        `Operația „${operatie}" se transmite prin referință la un contract deja înregistrat la ` +
        "REGES, iar contractul acesta n-are încă identificator. Transmiteți întâi adăugarea lui.",
    };
  }

  if (operatie === "AdaugareContract" && stare.regesContractId !== null) {
    return {
      ok: false,
      motiv: "Contractul are deja identificator REGES: adăugarea lui s-a transmis o dată.",
    };
  }

  pasi.push({
    tip: operatie === "PropunereDetasareContract" ? "propunere_detasare" : "contract",
    operatie,
    ordine: pasi.length,
    // Contractul depinde de salariat DOAR dacă salariatul se înregistrează acum.
    depindeDePrecedentul: pasi.length > 0,
    explicatie: explicaOperatia(operatie),
  });

  return { ok: true, valoare: pasi };
}

function explicaOperatia(operatie: Operatie): string {
  switch (operatie) {
    case "AdaugareContract":
      return "Contractul se înregistrează la Inspecția Muncii.";
    case "ModificareContract":
      return "Modificarea se transmite prin referință la contractul existent.";
    case "SuspendareContract":
      return "Suspendarea se transmite ca acțiune pe contract, cu temeiul legal.";
    case "ReactivareContract":
      return "Reluarea activității închide suspendarea la REGES.";
    case "IncetareContract":
      return "Încetarea se transmite cel târziu la data încetării.";
    case "PropunereDetasareContract":
      return "Detașarea pleacă drept PROPUNERE; angajatorul destinație o acceptă separat.";
    default:
      return "Se transmite la Inspecția Muncii.";
  }
}
