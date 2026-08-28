// src/domain/reges/operatii.ts
//
// Vocabularul protocolului REGES 2025, ca uniuni literale.
//
// Valorile sunt cele din `Schema reges.xsd`, LITERAL, inclusiv scrierea
// PascalCase. Nu sunt identificatori de domeniu, ci vocabular de protocol — ca
// numele metodelor HTTP. Orice traducere ar cere o tabelă de mapare ținută
// sincronizată cu un sistem pe care nu-l controlăm, iar prima valoare uitată
// acolo ar produce un mesaj respins fără explicație lizibilă.
//
// README-ul oficial enumeră greșit operațiile (spune `ActiuneIncetare`, care e
// `$type`-ul obiectului `actiune`, nu o operație). Lista de mai jos e din XSD.

export const OPERATII_SALARIAT = ["InregistrareSalariat", "ModificareSalariat"] as const;

export const OPERATII_CONTRACT = [
  "AdaugareContract",
  "ModificareContract",
  "RadiereContract",
  "IncetareContract",
  "CorectieIncetareContract",
  "AnulareIncetareContract",
  "SuspendareContract",
  "CorectieSuspendareContract",
  "ModificareSuspendareContract",
  "IncetareSuspendareContract",
  "ReactivareContract",
  "CorectieReactivareContract",
  "AnulareReactivareContract",
] as const;

export const OPERATII_PROPUNERE = [
  "PropunereDetasareContract",
  "AcceptarePropunereDetasareContract",
  "RespingerePropunereDetasareContract",
  "IncetarePropunereDetasareContract",
  "PropunereMutareContract",
  "AcceptarePropunereMutareContract",
  "RespingerePropunereMutareContract",
  "IncetarePropunereMutareContract",
] as const;

export const OPERATII = [
  ...OPERATII_SALARIAT,
  ...OPERATII_CONTRACT,
  ...OPERATII_PROPUNERE,
] as const;

export type OperatieSalariat = (typeof OPERATII_SALARIAT)[number];
export type OperatieContract = (typeof OPERATII_CONTRACT)[number];
export type OperatiePropunere = (typeof OPERATII_PROPUNERE)[number];
export type Operatie = (typeof OPERATII)[number];

/** `xsi:type` al mesajului. În JSON, cheia se numește `$type` și e camelCase. */
export const TIPURI_MESAJ = [
  "salariat",
  "contract",
  "propunereDetasareContract",
  "propunereMutareContract",
] as const;
export type TipMesaj = (typeof TIPURI_MESAJ)[number];

/** `$type`-ul obiectului `actiune` dintr-un mesaj de contract. */
export const TIPURI_ACTIUNE = [
  "actiuneIncetare",
  "actiuneSuspendare",
  "actiuneReactivare",
  "actiuneDetasare",
] as const;
export type TipActiune = (typeof TIPURI_ACTIUNE)[number];

// ── Enum-uri de conținut ────────────────────────────────────────────────────

export const TIPURI_CONTRACT = [
  "ContractIndividualMunca",
  "ContractUcenicie",
  "ContractMuncaLaDomiciliu",
  "ContractMuncaTemporara",
  "ContractIndividualMuncaTineriDezavantajati",
  "ContractIndividualMuncaClauzaTelemunca",
  "ContractMuncaTemporaraClauzaTelemunca",
  "DecizieDetasare",
  "ContractIndividualMuncaPlataCuOra",
  "RaportDeServiciu",
  "RaportDeServiciuCuStatutSpecial",
  "ContractDeManagement",
  "ContractDeMuncaPentruGarzi",
  "ContractDeActivitateSportiva",
  "ActAdministrativDemnitar",
  "ContractConsilierPersonalDemnitar",
] as const;
export type TipContract = (typeof TIPURI_CONTRACT)[number];

export const TIPURI_DURATA = ["Nedeterminata", "Determinata"] as const;
export type TipDurata = (typeof TIPURI_DURATA)[number];

export const TIPURI_NORMA = ["NormaIntreaga", "TimpPartial", "NormaOUG132"] as const;
export type TipNorma = (typeof TIPURI_NORMA)[number];

export const NORME_TIMP_MUNCA = [
  "NormaIntreaga840",
  "NormaIntreaga630",
  "NormaIntreagaLegiSpeciale",
  "TimpPartial",
  "TimpOUG132",
] as const;
export type NormaTimpMunca = (typeof NORME_TIMP_MUNCA)[number];

export const REPARTIZARI = [
  "OreDeZi",
  "OreDeNoapte",
  "Inegal",
  "OreInRepaos",
  "OreZiSiRepaos",
  "OreNoapteSiRepaos",
  "OreZiNoapteSiRepaos",
] as const;
export type Repartizare = (typeof REPARTIZARI)[number];

export const TIPURI_ACT_IDENTITATE = [
  "CarteIdentitate",
  "Pasaport",
  "BuletinIdentitate",
  "Alt",
  "CarteDeRezidenta",
  "PermisDeSedere",
  "AltActIdentitateRomanesc",
  "AltApatridTolerat",
  "NIF",
  "CertificatInregistrare",
  "PasaportBeneficiarProtectieInternationala",
  "AvizDeAngajare",
  "DocumentDeIdentitatetemporara",
] as const;
export type TipActIdentitate = (typeof TIPURI_ACT_IDENTITATE)[number];

// ── Deduceri din modelul intern ─────────────────────────────────────────────

/**
 * `TipNorma` din orele săptămânale.
 *
 * ⚠ Deducția e o PROPUNERE, nu un adevăr. `NormaOUG132` (Kurzarbeit) nu se poate
 * distinge de timpul parțial obișnuit după numărul de ore — e o decizie
 * administrativă. De aceea coloana `reges_tip_norma` există separat pe contract:
 * ce spune funcția asta e doar valoarea implicită a formularului.
 */
export function propuneTipNorma(oreSaptamana: number): TipNorma {
  return oreSaptamana >= 40 ? "NormaIntreaga" : "TimpPartial";
}

/**
 * `NormaTimpMunca` din orele zilnice și săptămânale.
 *
 * `NormaIntreaga630` acoperă normele reduse legale (6 ore/zi, 30/săptămână) —
 * de exemplu munca în condiții speciale. Nu se deduce din `conditii_munca`,
 * fiindcă un contract în condiții deosebite poate avea normă întreagă 8/40.
 */
export function propuneNormaTimpMunca(oreZi: number, oreSaptamana: number): NormaTimpMunca {
  if (oreZi >= 8 && oreSaptamana >= 40) return "NormaIntreaga840";
  if (oreZi >= 6 && oreSaptamana >= 30 && oreSaptamana < 40) return "NormaIntreaga630";
  return "TimpPartial";
}

/**
 * `TipContract` din regimul special și modul de lucru.
 *
 * Modelul intern nu are noțiunea de „tip de contract" în sensul REGES: are
 * `contract_duration` (determinat/nedeterminat), `work_mode` și
 * `special_regime`. Cele 16 valori REGES se suprapun peste ele doar parțial —
 * `RaportDeServiciu`, `ContractDeManagement` sau `ActAdministrativDemnitar` nu
 * au niciun corespondent local. De aceea rezultatul e o propunere, iar coloana
 * `reges_tip_contract` rămâne editabilă.
 */
export function propuneTipContract(input: {
  readonly regimSpecial: "ucenicie" | "internship" | "zilier" | null;
  readonly modLucru: "sediu" | "telemunca" | "domiciliu" | "mixt";
}): TipContract {
  if (input.regimSpecial === "ucenicie") return "ContractUcenicie";
  if (input.modLucru === "domiciliu") return "ContractMuncaLaDomiciliu";
  if (input.modLucru === "telemunca") return "ContractIndividualMuncaClauzaTelemunca";
  return "ContractIndividualMunca";
}
