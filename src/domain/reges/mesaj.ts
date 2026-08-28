// src/domain/reges/mesaj.ts
//
// Forma mesajelor REGES în JSON, plus constructorul de antet.
//
// SCHEMA ACCEPTĂ ȘI XML, ȘI JSON. Alegem JSON, dar cu o rezervă: colecția
// Postman oficială arată că serializarea e cea polimorfă .NET, deci
// discriminatorul se numește `$type` și e obligatoriu ȘI pe obiectele
// imbricate — `continutContract`, `referinta`, `actiuneIncetare`. Un `referinta`
// fără `$type` e o deserializare eșuată pe server, întoarsă ca 400 fără să spună
// care câmp. Tipurile de mai jos fac `$type` NEOMISIBIL, ca uitarea lui să fie
// eroare de compilare, nu descoperire în producție.
//
// Valorile lui `$type` sunt luate din colecția Postman, nu din XSD (XSD-ul dă
// numele XML, PascalCase). Dacă serverul le respinge, singurul loc de schimbat e
// fișierul ăsta — clientul HTTP nu știe nimic despre forma mesajului.

import { momentIso } from "./formate";
import type {
  Operatie,
  TipActIdentitate,
  TipContract,
  TipDurata,
  TipNorma,
  NormaTimpMunca,
  Repartizare,
} from "./operatii";

/** Versiunea schemei. `5` la data scrierii; se transmite ca șir. */
export const VERSIUNE_SCHEMA = "5";

export type Antet = Readonly<{
  messageId: string;
  clientApplication: string;
  version: string;
  operation: Operatie;
  authorId: string;
  sessionId: string;
  user: string;
  timestamp: string;
}>;

export type Referinta = Readonly<{ $type: "referinta"; id: string }>;

export const referinta = (id: string): Referinta => ({ $type: "referinta", id });

/** `Nationalitate` și `TaraDomiciliu` se transmit prin NUME, nu prin id. */
export type NumeNomenclator = Readonly<{ nume: string }>;

export type InfoSalariat = Readonly<{
  $type: "infoSalariat";
  cnp: string;
  nume: string;
  prenume: string;
  adresa: string;
  taraDomiciliu: NumeNomenclator;
  tipActIdentitate: TipActIdentitate;
  nationalitate?: NumeNomenclator;
  dataNastere?: string;
  localitate?: NumeNomenclator;
  mentiuni?: string;
}>;

export type MesajSalariat = Readonly<{
  $type: "salariat";
  header: Antet;
  referintaSalariat?: Referinta;
  info: InfoSalariat;
}>;

export type Cor = Readonly<{ cod: string; versiune?: number }>;

export type TimpMunca = Readonly<{
  norma: NormaTimpMunca;
  repartizare: Repartizare;
}>;

export type ContinutContract = Readonly<{
  $type: "continutContract";
  referintaSalariat: Referinta;
  numarContract: string;
  dataContract: string;
  dataInceputContract: string;
  tipContract: TipContract;
  tipDurata: TipDurata;
  tipNorma: TipNorma;
  timpMunca: TimpMunca;
  salariu: number;
  moneda: string;
  cor: Cor;
  dataConsemnare?: string;
  dataSfarsitContract?: string;
}>;

export type ActiuneIncetare = Readonly<{
  $type: "actiuneIncetare";
  dataIncetare: string;
  temeiLegal: string;
  explicatie?: string;
}>;

export type ActiuneSuspendare = Readonly<{
  $type: "actiuneSuspendare";
  dataInceput: string;
  temeiLegal: string;
  dataSfarsit?: string;
  explicatie?: string;
}>;

export type ActiuneReactivare = Readonly<{
  $type: "actiuneReactivare";
  dataReactivare: string;
  temeiLegal?: string;
  explicatie?: string;
}>;

export type Actiune = ActiuneIncetare | ActiuneSuspendare | ActiuneReactivare;

export type MesajContract = Readonly<{
  $type: "contract";
  header: Antet;
  referintaContract?: Referinta;
  continut?: ContinutContract;
  actiune?: Actiune;
}>;

export type MesajPropunere = Readonly<{
  $type: "propunereDetasareContract" | "propunereMutareContract";
  header: Antet;
  referintaContract?: Referinta;
  referintaPropunere?: Referinta;
  dataInceput?: string;
  dataSfarsit?: string;
  temeiLegal?: string;
  cuiAngajatorDestinatie?: string;
  explicatie?: string;
}>;

export type Mesaj = MesajSalariat | MesajContract | MesajPropunere;

// ── Antetul ─────────────────────────────────────────────────────────────────

export type ContextAntet = Readonly<{
  /** UUID-ul mesajului, generat de noi. Cheia de corelare cu recipisa. */
  messageId: string;
  operatie: Operatie;
  /** UUID-ul utilizatorului din ERP care a inițiat acțiunea. */
  autorId: string;
  /** UUID per sesiune de operare — un ciclu de reconciliere sau o apăsare de buton. */
  sesiuneId: string;
  /** Numele afișat al utilizatorului. */
  utilizator: string;
  /** Numele aplicației, așa cum îl vede Inspecția Muncii în jurnalul ei. */
  aplicatie?: string;
  cand?: Date;
}>;

export const APLICATIE_IMPLICITA = "Administrativo";

export function construiesteAntet(ctx: ContextAntet): Antet {
  return {
    messageId: ctx.messageId,
    clientApplication: ctx.aplicatie ?? APLICATIE_IMPLICITA,
    version: VERSIUNE_SCHEMA,
    operation: ctx.operatie,
    authorId: ctx.autorId,
    sessionId: ctx.sesiuneId,
    user: ctx.utilizator,
    timestamp: momentIso(ctx.cand),
  };
}

/**
 * Rezultatul asincron, așa cum apare în coada angajatorului.
 *
 * `responseId` e cheia de corelare: îl primim sincron la POST, ca recipisă, și
 * ne vine înapoi aici, când procesarea chiar s-a terminat. `header.messageId`
 * rămâne rezervă — nu toate implementările îl ecoului.
 */
export type RezultatMesaj = Readonly<{
  responseId: string;
  header?: Partial<Antet>;
  result: Readonly<{
    code: "SUCCES" | "FAIL";
    codeType: "SUCCES" | "WARNING" | "ERROR";
    description?: string | null;
    ref?: string | null;
    secRef?: string | null;
    relatedResultsExpected: boolean;
  }>;
}>;
