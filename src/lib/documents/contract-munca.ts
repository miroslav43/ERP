// src/lib/documents/contract-munca.ts
// Generarea contractului individual de muncă la înrolare — pe motorul comun
// din `generator.ts`. Spre deosebire de adeverințe (`cnp_mascat`), un contract
// real cere CNP-ul complet: se decriptează prin `hr_read_sensitive`, RPC deja
// folosit de `dezvaluieDateSensibile`.
import { decrypt, dinBytea } from "@/lib/crypto/aes-gcm";
import { formatDate } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { notFound } from "@/lib/actions/errors";
import type { ServerSupabase } from "@/lib/supabase/server";
import { genereazaDocument, type DocumentGenerat } from "./generator";

export type ParametriContractMunca = {
  readonly organizationId: string;
  readonly employeeId: string;
  readonly contractId: string;
  readonly emisDe: string;
  readonly numarContract: string;
  readonly dataContract: string;
  readonly angajatNume: string;
  readonly angajatAdresa: string | null;
  readonly functie: string | null;
  readonly departament: string | null;
  readonly dataAngajarii: string;
  readonly durataContract: string;
  readonly normaOreSaptamana: number;
  readonly normaOreZi: number;
  readonly modLucru: string;
  readonly salariuBrut: number;
  readonly zileConcediuAnual: number;
};

export async function genereazaContractDeMunca(
  supabase: ServerSupabase,
  parametri: ParametriContractMunca,
): Promise<DocumentGenerat> {
  const { data: organizatie } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", parametri.organizationId)
    .maybeSingle();
  if (organizatie === null) throw notFound("Organizația nu a putut fi citită.");

  const { data: sensibile } = await supabase.rpc("hr_read_sensitive", {
    p_employee: parametri.employeeId,
  });
  const randSensibil = sensibile?.[0];
  const cnpComplet =
    randSensibil?.cnp_ciphertext === undefined ||
    randSensibil.cnp_ciphertext === null ||
    randSensibil.cnp_iv === null ||
    randSensibil.cnp_tag === null ||
    randSensibil.cnp_key_version === null
      ? "CNP nefurnizat la înrolare"
      : decrypt({
          ciphertext: dinBytea(randSensibil.cnp_ciphertext),
          iv: dinBytea(randSensibil.cnp_iv),
          tag: dinBytea(randSensibil.cnp_tag),
          keyVersion: String(randSensibil.cnp_key_version),
        });

  const valori = new Map<string, string>([
    ["numar_contract", parametri.numarContract],
    ["data_contract", formatDate(parametri.dataContract)],
    ["organizatie_denumire", organizatie.name],
    ["angajat_nume", parametri.angajatNume],
    ["cnp_complet", cnpComplet],
    ["angajat_adresa", parametri.angajatAdresa ?? "nespecificată"],
    ["functie", parametri.functie ?? "nespecificată"],
    ["departament", parametri.departament ?? "nespecificat"],
    ["data_angajarii", formatDate(parametri.dataAngajarii)],
    ["durata_contract", parametri.durataContract],
    ["norma_ore_saptamana", String(parametri.normaOreSaptamana)],
    ["norma_ore_zi", String(parametri.normaOreZi)],
    ["mod_lucru", parametri.modLucru],
    ["salariu_brut", formatLei(parametri.salariuBrut)],
    ["zile_concediu_anual", String(parametri.zileConcediuAnual)],
  ]);

  return genereazaDocument(supabase, {
    organizationId: parametri.organizationId,
    employeeId: parametri.employeeId,
    codSablon: "contract_munca",
    emisDe: parametri.emisDe,
    valori,
    contractId: parametri.contractId,
  });
}
