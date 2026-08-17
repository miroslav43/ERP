// src/domain/revisal/export.ts
//
// ⚠ FORMATUL FIȘIERULUI REVISAL NU ESTE CONFIRMAT.
// Aplicația oficială ReviSal a Inspecției Muncii importă un format binar/XML propriu,
// a cărui specificație se obține de la ITM. NU inventăm serializarea și NU o prezentăm
// ca fiind corectă. Modulul livrează STRUCTURA DE DATE completă (`RezultatExport`), care
// este stabilă și verificabilă, plus un CSV lizibil ca soluție INTERIMARĂ, pentru ca
// operatorul de personal să poată introduce/controla evenimentele în ReviSal.
// Serializarea finală (`serializeazaOficial`) rămâne DE CONFIRMAT cu ITM.

import type { TipEvenimentRevisal, ZiIso } from "./evenimente";

export interface AngajatorExport {
  readonly cui: string;
  readonly denumire: string;
  readonly registruComert: string | null;
}

export interface SalariatExport {
  readonly employeeId: string;
  readonly marca: string;
  readonly nume: string;
  readonly prenume: string;
  /** Doar ultimele 4 cifre; CNP-ul complet se decriptează separat, cu rând de audit. */
  readonly cnpUltimele4: string | null;
  readonly cetatenie: string;
}

export interface ContractExport {
  readonly contractId: string;
  readonly numar: string;
  readonly dataContract: ZiIso;
  readonly valabilDeLa: ZiIso;
  readonly valabilPana: ZiIso | null;
  readonly durata: "nedeterminat" | "determinat";
  readonly normaOreSaptamana: number;
  readonly normaOreZi: number;
  readonly codCor: string | null;
  readonly denumireFunctie: string | null;
  readonly conditiiMunca: "normale" | "deosebite" | "speciale";
  readonly salariuBaza: number;
  readonly moneda: string;
  readonly codRevisal: string | null;
  readonly temeiIncetare: string | null;
  readonly dataIncetare: ZiIso | null;
}

export interface IntrareExport {
  readonly evenimentId: string;
  readonly tip: TipEvenimentRevisal;
  readonly codEveniment: string | null;
  readonly dataEvenimentului: ZiIso;
  readonly termenTransmitere: ZiIso;
  readonly salariat: SalariatExport;
  readonly contract: ContractExport | null;
}

export interface ProblemaExport {
  readonly evenimentId: string;
  readonly camp: string;
  readonly mesaj: string;
  readonly blocant: boolean;
}

export interface RezultatExport {
  readonly angajator: AngajatorExport;
  readonly generatLa: ZiIso;
  readonly intrari: readonly IntrareExport[];
  readonly probleme: readonly ProblemaExport[];
  /** Id-urile evenimentelor care nu au nicio problemă blocantă. */
  readonly gataDeTransmis: readonly string[];
}

const TIPAR_COD_COR = /^[0-9]{6}$/;

function problema(
  evenimentId: string,
  camp: string,
  mesaj: string,
  blocant: boolean,
): ProblemaExport {
  return { evenimentId, camp, mesaj, blocant };
}

function verificaIntrare(intrare: IntrareExport, azi: ZiIso): readonly ProblemaExport[] {
  const gasite: ProblemaExport[] = [];
  const numeAfisat = `${intrare.salariat.nume} ${intrare.salariat.prenume}`;

  if (intrare.salariat.cnpUltimele4 === null) {
    gasite.push(
      problema(
        intrare.evenimentId,
        "cnp",
        `${numeAfisat} nu are CNP înregistrat. Registrul nu poate fi transmis fără CNP.`,
        true,
      ),
    );
  }
  if (intrare.contract === null) {
    gasite.push(
      problema(
        intrare.evenimentId,
        "contract",
        `Evenimentul lui ${numeAfisat} nu este legat de un contract de muncă.`,
        true,
      ),
    );
    return gasite;
  }
  const contract = intrare.contract;
  if (contract.codCor === null || !TIPAR_COD_COR.test(contract.codCor)) {
    gasite.push(
      problema(
        intrare.evenimentId,
        "cod_cor",
        `Funcția de pe contractul ${contract.numar} nu are cod COR din 6 cifre.`,
        true,
      ),
    );
  }
  if (contract.durata === "determinat" && contract.valabilPana === null) {
    gasite.push(
      problema(
        intrare.evenimentId,
        "valabil_pana",
        `Contractul ${contract.numar} este pe durată determinată, dar nu are dată de sfârșit.`,
        true,
      ),
    );
  }
  if (!(contract.salariuBaza > 0)) {
    gasite.push(
      problema(
        intrare.evenimentId,
        "salariu_baza",
        `Contractul ${contract.numar} nu are salariu de bază completat.`,
        true,
      ),
    );
  }
  if (intrare.tip === "incetare" && contract.temeiIncetare === null) {
    gasite.push(
      problema(
        intrare.evenimentId,
        "temei_incetare",
        `Încetarea contractului ${contract.numar} nu are temeiul legal completat (articol din Codul muncii).`,
        true,
      ),
    );
  }
  if (intrare.termenTransmitere < azi) {
    gasite.push(
      problema(
        intrare.evenimentId,
        "termen_transmitere",
        `Termenul de transmitere pentru ${numeAfisat} a expirat la ${intrare.termenTransmitere}. Transmiterea cu întârziere rămâne obligatorie.`,
        false,
      ),
    );
  }
  return gasite;
}

export function construiesteExport(input: {
  readonly angajator: AngajatorExport;
  readonly intrari: readonly IntrareExport[];
  readonly azi: ZiIso;
}): RezultatExport {
  const probleme = input.intrari.flatMap((intrare) => verificaIntrare(intrare, input.azi));
  const blocante = new Set(probleme.filter((p) => p.blocant).map((p) => p.evenimentId));
  return {
    angajator: input.angajator,
    generatLa: input.azi,
    intrari: input.intrari,
    probleme,
    gataDeTransmis: input.intrari
      .filter((intrare) => !blocante.has(intrare.evenimentId))
      .map((intrare) => intrare.evenimentId),
  };
}

// ---------------------------------------------------------------- CSV interimar

const SEPARATOR = ";";
const SFARSIT_RAND = "\r\n";
const BOM = "\uFEFF";

const ANTET = [
  "Tip eveniment",
  "Cod",
  "Data evenimentului",
  "Termen transmitere",
  "Marcă",
  "Nume",
  "Prenume",
  "CNP (mascat)",
  "Cetățenie",
  "Număr contract",
  "Data contract",
  "Valabil de la",
  "Valabil până la",
  "Durată",
  "Ore/săptămână",
  "Ore/zi",
  "Cod COR",
  "Funcție",
  "Condiții de muncă",
  "Salariu de bază",
  "Monedă",
  "Cod REVISAL contract",
  "Temei încetare",
  "Data încetării",
] as const;

function celula(valoare: string | number | null): string {
  const text = valoare === null ? "" : String(valoare);
  return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function mascheazaCnp(ultimele4: string | null): string {
  return ultimele4 === null ? "" : `*********${ultimele4}`;
}

/**
 * CSV cu separator „;" și BOM, ca să se deschidă corect în Excel cu setări românești.
 * Este un LISTING DE LUCRU, nu fișierul oficial de import în ReviSal.
 */
export function laCsv(rezultat: RezultatExport): string {
  const randuri = rezultat.intrari.map((intrare) => {
    const c = intrare.contract;
    return [
      intrare.tip,
      intrare.codEveniment,
      intrare.dataEvenimentului,
      intrare.termenTransmitere,
      intrare.salariat.marca,
      intrare.salariat.nume,
      intrare.salariat.prenume,
      mascheazaCnp(intrare.salariat.cnpUltimele4),
      intrare.salariat.cetatenie,
      c?.numar ?? null,
      c?.dataContract ?? null,
      c?.valabilDeLa ?? null,
      c?.valabilPana ?? null,
      c?.durata ?? null,
      c?.normaOreSaptamana ?? null,
      c?.normaOreZi ?? null,
      c?.codCor ?? null,
      c?.denumireFunctie ?? null,
      c?.conditiiMunca ?? null,
      c === undefined || c === null ? null : c.salariuBaza.toFixed(2),
      c?.moneda ?? null,
      c?.codRevisal ?? null,
      c?.temeiIncetare ?? null,
      c?.dataIncetare ?? null,
    ]
      .map(celula)
      .join(SEPARATOR);
  });
  return BOM + [ANTET.join(SEPARATOR), ...randuri].join(SFARSIT_RAND) + SFARSIT_RAND;
}

export function numeFisierExport(cui: string, azi: ZiIso): string {
  return `revisal-${cui.replace(/[^0-9A-Za-z]/g, "")}-${azi}.csv`;
}
