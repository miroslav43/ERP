// src/app/(app)/reges/constante.ts
// Constante și scheme — separate de `actions.ts`, pentru că un modul "use server"
// poate exporta doar funcții async.
import { z } from "zod";

import {
  NORME_TIMP_MUNCA,
  REPARTIZARI,
  TIPURI_CONTRACT,
  TIPURI_NORMA,
} from "@/domain/reges/operatii";

import type { StatusReges, TipEvenimentReges } from "@/domain/reges/evenimente";
import type { FiltruStare } from "@/lib/queries/reges";

export const ETICHETE_TIP: Record<TipEvenimentReges, string> = {
  angajare: "Angajare",
  modificare_salariu: "Modificare salariu",
  modificare_functie: "Modificare funcție",
  modificare_norma: "Modificare normă",
  modificare_durata: "Modificare durată",
  suspendare: "Suspendare",
  reluare_activitate: "Reluare activitate",
  suspendare_nemotivata: "Suspendare (absențe nemotivate)",
  reluare_nemotivata: "Reluare după absențe nemotivate",
  detasare: "Detașare",
  incetare: "Încetare",
  corectie: "Corecție",
};

export const ETICHETE_STATUS: Record<StatusReges, string> = {
  de_pregatit: "De pregătit",
  pregatit: "Pregătit",
  transmis: "Transmis",
  confirmat: "Confirmat de ITM",
  respins: "Respins",
  anulat: "Anulat",
};

export const OPTIUNI_STARE: readonly {
  readonly valoare: FiltruStare;
  readonly eticheta: string;
}[] = [
  { valoare: "toate", eticheta: "Toate" },
  { valoare: "intarziate", eticheta: "Întârziate" },
  { valoare: "de_transmis", eticheta: "De transmis" },
  { valoare: "transmise", eticheta: "Transmise" },
];

export const marcheazaTransmisSchema = z.object({
  evenimentId: z.uuid("Evenimentul selectat nu este valid."),
  transmisLa: z.iso.date("Introduceți data transmiterii în formatul AAAA-LL-ZZ."),
  numarInregistrare: z
    .string()
    .trim()
    .min(1, "Introduceți numărul de înregistrare primit de la Inspecția Muncii.")
    .max(60, "Numărul de înregistrare este prea lung."),
  observatii: z.string().trim().max(500, "Observațiile depășesc 500 de caractere.").optional(),
});
export type MarcheazaTransmisInput = z.infer<typeof marcheazaTransmisSchema>;

export const exportaSchema = z.object({
  doarNetransmise: z.boolean().default(true),
});
export type ExportaInput = z.infer<typeof exportaSchema>;

// ── Coada de mesaje către API ───────────────────────────────────────────────

export const ETICHETE_STARE_MESAJ: Record<string, string> = {
  de_transmis: "De transmis",
  in_curs: "În curs",
  asteapta_raspuns: "Așteaptă răspuns",
  reusit: "Confirmat de ITM",
  esuat: "Respins",
  anulat: "Anulat",
};

export const ETICHETE_OPERATIE: Record<string, string> = {
  InregistrareSalariat: "Înregistrare salariat",
  ModificareSalariat: "Modificare salariat",
  AdaugareContract: "Adăugare contract",
  ModificareContract: "Modificare contract",
  RadiereContract: "Radiere contract",
  IncetareContract: "Încetare contract",
  CorectieIncetareContract: "Corecție încetare",
  AnulareIncetareContract: "Anulare încetare",
  SuspendareContract: "Suspendare contract",
  CorectieSuspendareContract: "Corecție suspendare",
  ModificareSuspendareContract: "Modificare suspendare",
  IncetareSuspendareContract: "Încetare suspendare",
  ReactivareContract: "Reactivare contract",
  CorectieReactivareContract: "Corecție reactivare",
  AnulareReactivareContract: "Anulare reactivare",
  PropunereDetasareContract: "Propunere detașare",
  AcceptarePropunereDetasareContract: "Acceptare detașare",
  RespingerePropunereDetasareContract: "Respingere detașare",
  IncetarePropunereDetasareContract: "Încetare detașare",
  PropunereMutareContract: "Propunere mutare",
  AcceptarePropunereMutareContract: "Acceptare mutare",
  RespingerePropunereMutareContract: "Respingere mutare",
  IncetarePropunereMutareContract: "Încetare mutare",
};

export const pregatesteSchema = z.object({
  evenimentId: z.uuid("Evenimentul selectat nu este valid."),
});
export type PregatesteInput = z.infer<typeof pregatesteSchema>;

export const transmiteSchema = z.object({
  mesajId: z.uuid("Mesajul selectat nu este valid."),
});
export type TransmiteInput = z.infer<typeof transmiteSchema>;

/**
 * Înregistrarea unui spor PROPRIU firmei în nomenclatorul REGES.
 *
 * `componentTypeId` e un tip din `salary_component_types` — nu denumirea
 * scrisă de mână: denumirea pleacă din rândul existent, ca sporul înregistrat
 * la ITM să poarte exact numele pe care îl vede lumea pe fluturaș.
 */
export const sporAngajatorSchema = z.object({
  componentTypeId: z.uuid("Tipul de spor selectat nu este valid."),
  dataInceputValabilitate: z.iso.date("Alegeți data de la care se aplică sporul."),
});
export type SporAngajatorInput = z.infer<typeof sporAngajatorSchema>;

export const anuleazaMesajSchema = z.object({
  mesajId: z.uuid("Mesajul selectat nu este valid."),
  motiv: z
    .string()
    .trim()
    .min(3, "Scrieți de ce anulați mesajul.")
    .max(300, "Motivul depășește 300 de caractere."),
});
export type AnuleazaMesajInput = z.infer<typeof anuleazaMesajSchema>;

// ── Credențiale ─────────────────────────────────────────────────────────────

export const MEDII = [
  { valoare: "test", eticheta: "Test (api.dev.inspectiamuncii.org)" },
  { valoare: "productie", eticheta: "Producție (api.inspectiamuncii.ro)" },
] as const;

/**
 * Secretele sunt OPȚIONALE la editare, deliberat: formularul nu le reafișează
 * niciodată, iar cerându-le la fiecare salvare am obliga operatorul să le
 * retasteze ca să schimbe CUI-ul. Funcția SQL păstrează valoarea existentă când
 * câmpul lipsește.
 */
export const credentialeSchema = z.object({
  mediu: z.enum(["test", "productie"], { message: "Alegeți mediul." }),
  cuiAngajator: z
    .string()
    .trim()
    .min(2, "Completați CUI-ul angajatorului.")
    .max(20, "CUI-ul este prea lung."),
  clientId: z.string().trim().min(1, "Completați Client ID.").max(120, "Client ID prea lung."),
  utilizator: z
    .string()
    .trim()
    .min(1, "Completați utilizatorul primit din portalul REGES.")
    .max(200, "Utilizatorul este prea lung."),
  clientSecret: z.string().trim().max(400, "Client Secret prea lung.").optional(),
  parola: z.string().trim().max(400, "Parola este prea lungă.").optional(),
});
export type CredentialeInput = z.infer<typeof credentialeSchema>;

export const activeazaSchema = z.object({
  activ: z.boolean(),
});
export type ActiveazaInput = z.infer<typeof activeazaSchema>;

// ── Propuneri ───────────────────────────────────────────────────────────────

export const raspundePropuneriiSchema = z.object({
  propunereId: z.uuid("Propunerea selectată nu este validă."),
  raspuns: z.enum(["acceptata", "respinsa"], { message: "Alegeți acceptarea sau respingerea." }),
  observatii: z.string().trim().max(500, "Observațiile depășesc 500 de caractere.").optional(),
});
export type RaspundePropuneriiInput = z.infer<typeof raspundePropuneriiSchema>;

/**
 * Propunerea PLECATĂ de la noi.
 *
 * Câmpurile nu vin din contract, ci de la operator: contractul nostru nu știe
 * nimic despre angajatorul destinație, iar REGES le cere pe toate.
 */
export const propunePlecareSchema = z.object({
  contractId: z.uuid("Contractul selectat nu este valid."),
  fel: z.enum(["detasare", "mutare"], { message: "Alegeți detașare sau mutare." }),
  cuiDestinatie: z
    .string()
    .trim()
    .min(2, "Completați CUI-ul angajatorului destinație.")
    .max(20, "CUI-ul este prea lung."),
  numeDestinatie: z.string().trim().max(200, "Denumirea este prea lungă.").optional(),
  dataInceput: z.iso.date("Introduceți data de început în formatul AAAA-LL-ZZ."),
  dataSfarsit: z.iso.date("Introduceți data de sfârșit în formatul AAAA-LL-ZZ.").optional(),
  temeiLegal: z
    .string()
    .trim()
    .min(1, "Alegeți temeiul legal din nomenclatorul TemeiDetasare.")
    .max(120, "Temeiul este prea lung."),
});
export type PropunePlecareInput = z.infer<typeof propunePlecareSchema>;

// ── Clasificarea REGES a contractului ───────────────────────────────────────

/**
 * Cele patru enum-uri pe care REGES le cere și modelul nostru nu le are.
 *
 * `contract_duration` (determinat/nedeterminat), `work_mode` și `special_regime`
 * acoperă doar o parte din cele 16 tipuri REGES: `RaportDeServiciu`,
 * `ContractDeManagement` sau `ActAdministrativDemnitar` nu se pot deduce din
 * nimic din ce ținem. De aceea deducția e o PROPUNERE, iar alegerea explicită se
 * face aici și bate deducția la compunerea mesajului.
 */
export const clasificareSchema = z.object({
  contractId: z.uuid("Contractul selectat nu este valid."),
  tipContract: z.enum(TIPURI_CONTRACT, { message: "Alegeți tipul de contract." }),
  tipNorma: z.enum(TIPURI_NORMA, { message: "Alegeți tipul de normă." }),
  normaTimp: z.enum(NORME_TIMP_MUNCA, { message: "Alegeți norma de timp de muncă." }),
  repartizare: z.enum(REPARTIZARI, { message: "Alegeți repartizarea programului." }),
  temeiIncetare: z.string().trim().max(120, "Temeiul este prea lung.").optional(),
});
export type ClasificareInput = z.infer<typeof clasificareSchema>;

/** Etichete în română pentru enum-urile de protocol. */
export const ETICHETE_TIP_CONTRACT: Record<string, string> = {
  ContractIndividualMunca: "Contract individual de muncă",
  ContractUcenicie: "Contract de ucenicie",
  ContractMuncaLaDomiciliu: "Muncă la domiciliu",
  ContractMuncaTemporara: "Muncă temporară",
  ContractIndividualMuncaTineriDezavantajati: "CIM tineri dezavantajați",
  ContractIndividualMuncaClauzaTelemunca: "CIM cu clauză de telemuncă",
  ContractMuncaTemporaraClauzaTelemunca: "Muncă temporară cu telemuncă",
  DecizieDetasare: "Decizie de detașare",
  ContractIndividualMuncaPlataCuOra: "CIM cu plata cu ora",
  RaportDeServiciu: "Raport de serviciu",
  RaportDeServiciuCuStatutSpecial: "Raport de serviciu cu statut special",
  ContractDeManagement: "Contract de management",
  ContractDeMuncaPentruGarzi: "Contract pentru gărzi",
  ContractDeActivitateSportiva: "Contract de activitate sportivă",
  ActAdministrativDemnitar: "Act administrativ — demnitar",
  ContractConsilierPersonalDemnitar: "Consilier personal al demnitarului",
};

export const ETICHETE_TIP_NORMA: Record<string, string> = {
  NormaIntreaga: "Normă întreagă",
  TimpPartial: "Timp parțial",
  NormaOUG132: "Kurzarbeit (O.U.G. 132/2020)",
};

export const ETICHETE_NORMA_TIMP: Record<string, string> = {
  NormaIntreaga840: "8 ore/zi, 40 ore/săptămână",
  NormaIntreaga630: "6 ore/zi, 30 ore/săptămână",
  NormaIntreagaLegiSpeciale: "Normă întreagă — legi speciale",
  TimpPartial: "Timp parțial",
  TimpOUG132: "Timp redus O.U.G. 132/2020",
};

export const ETICHETE_REPARTIZARE: Record<string, string> = {
  OreDeZi: "Ore de zi",
  OreDeNoapte: "Ore de noapte",
  Inegal: "Inegal (zi și noapte)",
  OreInRepaos: "Ore în repaus",
  OreZiSiRepaos: "Ore de zi și repaus",
  OreNoapteSiRepaos: "Ore de noapte și repaus",
  OreZiNoapteSiRepaos: "Ore de zi, noapte și repaus",
};
