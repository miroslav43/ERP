// Maparea pură a răspunsului ANAF v9 (PlatitorTvaRest) — fără I/O, testabilă
// fără rețea. Orice câmp lipsă sau cu formă neașteptată devine `null`:
// degradarea la completare manuală e comportamentul dorit, nu o eroare.

function caText(valoare: unknown): string | null {
  if (typeof valoare === "string" && valoare.trim().length > 0) return valoare.trim();
  if (typeof valoare === "number" && Number.isFinite(valoare)) return String(valoare);
  return null;
}

function caObiect(valoare: unknown): Record<string, unknown> | null {
  return typeof valoare === "object" && valoare !== null && !Array.isArray(valoare)
    ? (valoare as Record<string, unknown>)
    : null;
}

function caCodCaen(valoare: unknown): string | null {
  const text = caText(valoare);
  if (text === null) return null;
  const cifre = text.replace(/\D+/g, "");
  return /^[0-9]{4}$/.test(cifre) ? cifre : null;
}

export interface AdresaAnaf {
  readonly judet: string | null;
  readonly localitate: string | null;
  readonly strada: string | null;
  readonly numar: string | null;
  readonly codPostal: string | null;
}

export interface RezultatAnafGasit {
  readonly gasit: true;
  readonly denumire: string;
  readonly cui: string;
  readonly platitorTva: boolean;
  readonly regCom: string | null;
  readonly codCaen: string | null;
  readonly radiata: boolean;
  readonly adresa: AdresaAnaf;
}

export interface RezultatAnafNegasit {
  readonly gasit: false;
}

export type RezultatAnaf = RezultatAnafGasit | RezultatAnafNegasit;

const NEGASIT: RezultatAnafNegasit = { gasit: false };

export function mapeazaRaspunsAnaf(cuiNormalizat: string, raspuns: unknown): RezultatAnaf {
  const radacina = caObiect(raspuns);
  const gasite = radacina?.["found"];
  if (!Array.isArray(gasite) || gasite.length === 0) return NEGASIT;

  const intrare = caObiect(gasite[0]);
  if (intrare === null) return NEGASIT;

  const dateGenerale = caObiect(intrare["date_generale"]);
  const denumire = caText(dateGenerale?.["denumire"]);
  if (denumire === null) return NEGASIT;

  const inregistrareTva = caObiect(intrare["inregistrare_scop_Tva"]);
  const stareInactiv = caObiect(intrare["stare_inactiv"]);
  const adresaSediu = caObiect(intrare["adresa_sediu_social"]);

  return {
    gasit: true,
    denumire,
    cui: cuiNormalizat,
    platitorTva: inregistrareTva?.["scpTVA"] === true,
    regCom: caText(dateGenerale?.["nrRegCom"]),
    codCaen: caCodCaen(dateGenerale?.["cod_CAEN"]),
    radiata: stareInactiv?.["statusInactivi"] === true,
    adresa: {
      judet: caText(adresaSediu?.["sdenumire_Judet"]),
      localitate: caText(adresaSediu?.["sdenumire_Localitate"]),
      strada: caText(adresaSediu?.["sdenumire_Strada"]),
      numar: caText(adresaSediu?.["snumar_Strada"]),
      codPostal: caText(adresaSediu?.["scod_Postal"]),
    },
  };
}
