// src/lib/crypto/sensitive-data.ts
import "server-only";

import { valideazaCnp } from "@/domain/employee/cnp";
import { valideazaIban } from "@/domain/employee/iban";
import { amprentaSensibila, decrypt, encrypt } from "@/lib/crypto/aes-gcm";
import type { ServerSupabase } from "@/lib/supabase/server";

/**
 * Singurul drum de acces la CNP și IBAN.
 *
 * REGULA DE AUR: valorile decriptate nu ajung NICIODATĂ într-un Server
 * Component. Tot ce randează un Server Component intră în payload-ul RSC
 * trimis către browser, deci ar fi vizibil în trafic și în cache. De aceea:
 *   - pentru afișare se folosește `citesteDateSensibileMascate` (doar ultimele
 *     patru cifre, niciodată criptotext);
 *   - valoarea în clar se obține exclusiv din `citesteDateSensibile`, apelat
 *     dintr-un Server Action declanșat de un click explicit al utilizatorului.
 *
 * Jurnalizarea este garantată prin construcție: rândul de audit se scrie
 * ÎNAINTE de a decripta; dacă scrierea eșuează, valoarea nu se întoarce.
 * Tabela `employee_sensitive_data` este exclusă intenționat din trigger-ul
 * generic de audit (ar copia criptotextul în audit_logs), deci acesta este
 * singurul loc unde accesul se poate consemna.
 */

export type CampSensibil = "cnp" | "iban";

export type CodEroareDateSensibile =
  | "angajat_inexistent"
  | "cnp_invalid"
  | "iban_invalid"
  | "cnp_duplicat"
  | "rand_corupt"
  | "audit_esuat"
  | "eroare_bd";

export class EroareDateSensibile extends Error {
  readonly cod: CodEroareDateSensibile;

  constructor(cod: CodEroareDateSensibile, mesaj: string) {
    super(mesaj);
    this.name = "EroareDateSensibile";
    this.cod = cod;
  }
}

export interface EvenimentDateSensibile {
  readonly operatie: "citire" | "scriere";
  readonly employeeId: string;
  readonly organizationId: string;
  readonly campuri: readonly CampSensibil[];
  readonly motiv: string;
}

/** Scrie rândul de audit; implementată în stratul de acțiuni peste `writeAuditLog`. */
export type JurnalizeazaDateSensibile = (eveniment: EvenimentDateSensibile) => Promise<void>;

export interface OptiuniAcces {
  readonly campuri: readonly CampSensibil[];
  readonly motiv: string;
  readonly jurnalizeaza: JurnalizeazaDateSensibile;
}

export interface ValoriSensibile {
  readonly cnp: string | null;
  readonly iban: string | null;
}

export interface DateSensibileMascate {
  readonly areCnp: boolean;
  readonly cnpMascat: string | null;
  readonly cnpUltimele4: string | null;
  readonly areIban: boolean;
  readonly ibanMascat: string | null;
  readonly ibanUltimele4: string | null;
  readonly banca: string | null;
}

export interface IntrareDateSensibile {
  readonly cnp?: string | null;
  readonly iban?: string | null;
  readonly banca?: string | null;
}

const COLOANE =
  "employee_id, organization_id, cnp_ciphertext, cnp_iv, cnp_tag, cnp_key_version, cnp_last4, iban_ciphertext, iban_iv, iban_tag, iban_key_version, iban_last4, banca";

const LUNGIME_CNP = 13;
const LUNGIME_IBAN = 24;

/** Mascare de tip `1******9`: se păstrează doar prima și ultima poziție. */
export function mascheaza(valoare: string): string {
  const curat = valoare.trim();
  if (curat.length <= 2) {
    return "*".repeat(curat.length);
  }
  return `${curat.slice(0, 1)}${"*".repeat(curat.length - 2)}${curat.slice(-1)}`;
}

function mascheazaDinUltimele4(ultimele4: string | null, lungime: number): string | null {
  if (ultimele4 === null) {
    return null;
  }
  return `${"*".repeat(Math.max(lungime - ultimele4.length, 0))}${ultimele4}`;
}

function caText(valoare: unknown): string | null {
  return typeof valoare === "string" && valoare.length > 0 ? valoare : null;
}

function caNumar(valoare: unknown): number | null {
  return typeof valoare === "number" && Number.isInteger(valoare) ? valoare : null;
}

function bufferInHex(valoare: Buffer): string {
  return `\\x${valoare.toString("hex")}`;
}

function hexInBuffer(valoare: string | null, camp: string): Buffer | null {
  if (valoare === null) {
    return null;
  }
  const curat = valoare.startsWith("\\x") ? valoare.slice(2) : valoare;
  if (curat.length === 0) {
    return null;
  }
  if (curat.length % 2 !== 0 || /[^0-9a-fA-F]/.test(curat)) {
    throw new EroareDateSensibile(
      "rand_corupt",
      `Datele criptate pentru câmpul „${camp}” nu au un format valid. Contactați administratorul platformei.`,
    );
  }
  return Buffer.from(curat, "hex");
}

interface RandSensibil {
  readonly [cheie: string]: unknown;
}

function decripteazaCamp(rand: RandSensibil, camp: CampSensibil): string | null {
  const ciphertext = hexInBuffer(caText(rand[`${camp}_ciphertext`]), camp);
  const iv = hexInBuffer(caText(rand[`${camp}_iv`]), camp);
  const tag = hexInBuffer(caText(rand[`${camp}_tag`]), camp);
  const versiune = caNumar(rand[`${camp}_key_version`]);
  if (ciphertext === null || iv === null || tag === null || versiune === null) {
    return null;
  }
  return decrypt({ ciphertext, iv, tag, keyVersion: String(versiune) });
}

async function citesteRand(
  supabase: ServerSupabase,
  employeeId: string,
): Promise<RandSensibil | null> {
  const { data, error } = await supabase
    .from("employee_sensitive_data")
    .select(COLOANE)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error !== null) {
    throw new EroareDateSensibile(
      "eroare_bd",
      `Datele de identificare nu au putut fi citite: ${error.message}`,
    );
  }
  return data === null ? null : (data as RandSensibil);
}

async function citesteOrganizatia(supabase: ServerSupabase, employeeId: string): Promise<string> {
  const { data, error } = await supabase
    .from("employees")
    .select("id, organization_id")
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error !== null) {
    throw new EroareDateSensibile(
      "eroare_bd",
      `Fișa angajatului nu a putut fi citită: ${error.message}`,
    );
  }
  if (data === null) {
    throw new EroareDateSensibile(
      "angajat_inexistent",
      "Fișa de angajat nu există sau nu vă este accesibilă.",
    );
  }
  return data.organization_id;
}

/** Sigur în Server Components: nu decriptează nimic. */
export async function citesteDateSensibileMascate(
  supabase: ServerSupabase,
  employeeId: string,
): Promise<DateSensibileMascate> {
  const rand = await citesteRand(supabase, employeeId);
  if (rand === null) {
    return {
      areCnp: false,
      cnpMascat: null,
      cnpUltimele4: null,
      areIban: false,
      ibanMascat: null,
      ibanUltimele4: null,
      banca: null,
    };
  }
  const cnpUltimele4 = caText(rand["cnp_last4"]);
  const ibanUltimele4 = caText(rand["iban_last4"]);
  return {
    areCnp: caText(rand["cnp_ciphertext"]) !== null,
    cnpMascat: mascheazaDinUltimele4(cnpUltimele4, LUNGIME_CNP),
    cnpUltimele4,
    areIban: caText(rand["iban_ciphertext"]) !== null,
    ibanMascat: mascheazaDinUltimele4(ibanUltimele4, LUNGIME_IBAN),
    ibanUltimele4,
    banca: caText(rand["banca"]),
  };
}

/** Se apelează DOAR dintr-un Server Action, la cererea explicită a utilizatorului. */
export async function citesteDateSensibile(
  supabase: ServerSupabase,
  employeeId: string,
  optiuni: OptiuniAcces,
): Promise<ValoriSensibile> {
  if (optiuni.campuri.length === 0) {
    return { cnp: null, iban: null };
  }
  const organizationId = await citesteOrganizatia(supabase, employeeId);
  const rand = await citesteRand(supabase, employeeId);

  try {
    await optiuni.jurnalizeaza({
      operatie: "citire",
      employeeId,
      organizationId,
      campuri: optiuni.campuri,
      motiv: optiuni.motiv,
    });
  } catch (eroare) {
    throw new EroareDateSensibile(
      "audit_esuat",
      `Accesul la datele de identificare nu a putut fi înregistrat în jurnal, așa că valorile nu au fost afișate. Încercați din nou. (${eroare instanceof Error ? eroare.message : "cauză necunoscută"})`,
    );
  }

  if (rand === null) {
    return { cnp: null, iban: null };
  }
  return {
    cnp: optiuni.campuri.includes("cnp") ? decripteazaCamp(rand, "cnp") : null,
    iban: optiuni.campuri.includes("iban") ? decripteazaCamp(rand, "iban") : null,
  };
}

function payloadCamp(
  camp: CampSensibil,
  valoare: string | null,
): Record<string, string | number | null> {
  if (valoare === null) {
    return {
      [`${camp}_ciphertext`]: null,
      [`${camp}_iv`]: null,
      [`${camp}_tag`]: null,
      [`${camp}_key_version`]: null,
      [`${camp}_last4`]: null,
      [`${camp}_hash`]: null,
    };
  }
  const criptat = encrypt(valoare);
  return {
    [`${camp}_ciphertext`]: bufferInHex(criptat.ciphertext),
    [`${camp}_iv`]: bufferInHex(criptat.iv),
    [`${camp}_tag`]: bufferInHex(criptat.tag),
    [`${camp}_key_version`]: Number(criptat.keyVersion),
    [`${camp}_last4`]: valoare.slice(-4),
    [`${camp}_hash`]: amprentaSensibila(valoare),
  };
}

export async function scrieDateSensibile(
  supabase: ServerSupabase,
  employeeId: string,
  intrare: IntrareDateSensibile,
  optiuni: { readonly motiv: string; readonly jurnalizeaza: JurnalizeazaDateSensibile },
): Promise<DateSensibileMascate> {
  const organizationId = await citesteOrganizatia(supabase, employeeId);
  const campuri: CampSensibil[] = [];
  let payload: Record<string, string | number | null> = {};

  if (intrare.cnp !== undefined) {
    let cnpCurat: string | null = null;
    if (intrare.cnp !== null && intrare.cnp.trim().length > 0) {
      const rezultat = valideazaCnp(intrare.cnp);
      if (!rezultat.valid) {
        throw new EroareDateSensibile("cnp_invalid", rezultat.mesaj);
      }
      cnpCurat = rezultat.cnp;
    }
    payload = { ...payload, ...payloadCamp("cnp", cnpCurat) };
    campuri.push("cnp");
  }

  if (intrare.iban !== undefined) {
    let ibanCurat: string | null = null;
    if (intrare.iban !== null && intrare.iban.trim().length > 0) {
      const rezultat = valideazaIban(intrare.iban);
      if (!rezultat.valid) {
        throw new EroareDateSensibile("iban_invalid", rezultat.mesaj);
      }
      ibanCurat = rezultat.iban;
    }
    payload = { ...payload, ...payloadCamp("iban", ibanCurat) };
    campuri.push("iban");
  }

  if (intrare.banca !== undefined) {
    const banca = intrare.banca === null ? null : intrare.banca.trim();
    payload = { ...payload, banca: banca !== null && banca.length > 0 ? banca : null };
  }

  if (Object.keys(payload).length === 0) {
    return citesteDateSensibileMascate(supabase, employeeId);
  }

  // organization_id vine din rândul citit din baza de date, niciodată de la client (S1).
  const { error } = await supabase
    .from("employee_sensitive_data")
    .upsert(
      { ...payload, employee_id: employeeId, organization_id: organizationId },
      { onConflict: "employee_id" },
    );

  if (error !== null) {
    if (error.code === "23505") {
      throw new EroareDateSensibile(
        "cnp_duplicat",
        "CNP-ul introdus există deja la un alt angajat din firmă. Verificați dacă persoana are deja o fișă.",
      );
    }
    throw new EroareDateSensibile(
      "eroare_bd",
      `Datele de identificare nu au putut fi salvate: ${error.message}`,
    );
  }

  try {
    await optiuni.jurnalizeaza({
      operatie: "scriere",
      employeeId,
      organizationId,
      campuri,
      motiv: optiuni.motiv,
    });
  } catch (eroare) {
    throw new EroareDateSensibile(
      "audit_esuat",
      `Modificarea a fost salvată, dar nu a putut fi înregistrată în jurnal. Anunțați administratorul. (${eroare instanceof Error ? eroare.message : "cauză necunoscută"})`,
    );
  }

  return citesteDateSensibileMascate(supabase, employeeId);
}
