// src/domain/reges/mapare.ts
//
// Traduce modelul intern de angajat și de contract în mesaje REGES.
//
// FUNCȚII PURE, CU INTRĂRI EXPLICITE
// Nu primesc rânduri din bază, ci structuri anume: apelantul e obligat să spună
// de unde vine fiecare valoare, iar modulul rămâne testabil fără Postgres. Mai
// important, forma intrării face vizibile golurile din modelul nostru — `cnp` e
// obligatoriu și nu are unde să vină de pe `employees`, pentru că trăiește
// criptat în `employee_sensitive_data`.
//
// CE NU FACE
// Nu decide dacă trebuie transmis ceva (asta e `plan.ts`) și nu verifică dacă
// datele sunt complete (asta e `validare.ts`). Dacă i se dau date incomplete,
// produce un mesaj incomplet — pe care validarea îl oprește înainte să plece.

import { text, zecimal, zi, ziCaMoment } from "./formate";
import {
  construiesteAntet,
  referinta,
  type ContextAntet,
  type ContinutContract,
  type InfoSalariat,
  type MesajContract,
  type MesajSalariat,
} from "./mesaj";
import type {
  NormaTimpMunca,
  OperatieSalariat,
  Repartizare,
  TipActIdentitate,
  TipContract,
  TipNorma,
} from "./operatii";
import type { ZiIso } from "./formate";
import type { SporSalarial } from "./mesaj";

export type SalariatIntern = Readonly<{
  /** CNP în clar. Vine decriptat, la momentul trimiterii — nu se persistă. */
  cnp: string;
  nume: string;
  prenume: string;
  /** Adresa de domiciliu, o singură linie: schema cere un `string`, nu componente. */
  adresa: string;
  /** Numele ȚĂRII din nomenclator, nu codul ISO2. Schema o cere prin nume. */
  taraDomiciliu: string;
  tipActIdentitate: TipActIdentitate;
  nationalitate: string | null;
  dataNasterii: ZiIso | null;
  localitate: string | null;
  /** Identificatorul REGES, dacă salariatul e deja înregistrat. */
  regesSalariatId: string | null;
}>;

export type ContractIntern = Readonly<{
  numar: string;
  dataContract: ZiIso;
  valabilDeLa: ZiIso;
  valabilPana: ZiIso | null;
  durataDeterminata: boolean;
  tipContract: TipContract;
  tipNorma: TipNorma;
  normaTimpMunca: NormaTimpMunca;
  repartizare: Repartizare;
  salariuBaza: number;
  moneda: string;
  /**
   * Sporurile active la data trimiterii, deja rezolvate în UUID-uri de
   * nomenclator. Tabloul gol e cazul obișnuit: majoritatea contractelor n-au
   * niciun spor, iar schema cere ca `sporuri` să lipsească atunci, nu să fie `[]`.
   */
  sporuri: readonly SporSalarial[];
  /** Codul COR de șase cifre. Rămâne, pentru validare și pentru mesajele de eroare. */
  codCor: string;
  /**
   * Identificatorul poziției COR în nomenclatorul REGES.
   *
   * `null` = codul n-a fost găsit în oglinda locală, iar mesajul NU are voie să
   * plece: un `cor` inventat trece de schemă și e refuzat asincron, ore mai
   * târziu, cu termenul legal deja curgând.
   */
  regesCorId: string | null;
  regesContractId: string | null;
}>;

/**
 * Compune adresa dintr-un rând de `employees`.
 *
 * Schema REGES cere `Adresa` ca un singur șir. Componentele goale se sar, ca să
 * nu producem „Str. Morii, , , " — un câmp care arată a eroare de import chiar
 * dacă trece validarea.
 */
export function compuneAdresa(parti: {
  readonly strada: string | null;
  readonly oras: string | null;
  readonly judet: string | null;
  readonly codPostal: string | null;
}): string {
  return [parti.strada, parti.oras, parti.judet, parti.codPostal]
    .map((p) => text(p))
    .filter((p): p is string => p !== undefined)
    .join(", ");
}

export function mapeazaSalariat(
  salariat: SalariatIntern,
  ctx: Omit<ContextAntet, "operatie"> & { readonly operatie?: OperatieSalariat },
): MesajSalariat {
  // Prezența identificatorului REGES decide operația: a doua `InregistrareSalariat`
  // pentru același om ar fi respinsă ca duplicat de CNP.
  const operatie: OperatieSalariat =
    ctx.operatie ??
    (salariat.regesSalariatId === null ? "InregistrareSalariat" : "ModificareSalariat");

  const info: InfoSalariat = {
    $type: "infoSalariat",
    cnp: salariat.cnp.trim(),
    nume: salariat.nume.trim(),
    prenume: salariat.prenume.trim(),
    adresa: salariat.adresa.trim(),
    taraDomiciliu: { nume: salariat.taraDomiciliu.trim() },
    tipActIdentitate: salariat.tipActIdentitate,
    ...(text(salariat.nationalitate) === undefined
      ? {}
      : { nationalitate: { nume: text(salariat.nationalitate) as string } }),
    ...(salariat.dataNasterii === null ? {} : { dataNastere: ziCaMoment(salariat.dataNasterii) }),
    ...(text(salariat.localitate) === undefined
      ? {}
      : { localitate: { nume: text(salariat.localitate) as string } }),
  };

  return {
    $type: "salariat",
    header: construiesteAntet({ ...ctx, operatie }),
    ...(salariat.regesSalariatId === null
      ? {}
      : { referintaSalariat: referinta(salariat.regesSalariatId) }),
    info,
  };
}

export function mapeazaContract(
  contract: ContractIntern,
  regesSalariatId: string,
  ctx: Omit<ContextAntet, "operatie"> & {
    readonly operatie?: "AdaugareContract" | "ModificareContract";
  },
): MesajContract {
  const operatie =
    ctx.operatie ?? (contract.regesContractId === null ? "AdaugareContract" : "ModificareContract");

  const continut: ContinutContract = {
    $type: "continutContract",
    referintaSalariat: referinta(regesSalariatId),
    numarContract: contract.numar.trim(),
    dataContract: ziCaMoment(contract.dataContract),
    dataInceputContract: ziCaMoment(contract.valabilDeLa),
    tipContract: contract.tipContract,
    tipDurata: contract.durataDeterminata ? "Determinata" : "Nedeterminata",
    tipNorma: contract.tipNorma,
    timpMunca: { norma: contract.normaTimpMunca, repartizare: contract.repartizare },
    salariu: {
      salariuBaza: zecimal(contract.salariuBaza),
      // Omis când e gol: un tablou vid nu e același lucru cu absența câmpului
      // pentru un deserializator strict.
      ...(contract.sporuri.length === 0
        ? {}
        : {
            sporuri: contract.sporuri.map((s) => ({
              referintaTipSpor: s.referintaTipSpor,
              // Aceeași tăiere a zgomotului de virgulă mobilă ca la salariu:
              // un spor de 10,5% nu are voie să plece ca 10,500000000000001.
              valoare: zecimal(s.valoare),
              esteProcent: s.esteProcent,
            })),
          }),
    },
    moneda: contract.moneda.trim().toUpperCase(),
    // `verificaContract` garantează că nu e null când s-a ajuns aici.
    cor: referinta(contract.regesCorId ?? ""),
    // Se transmite doar pentru durată determinată. Un `dataSfarsitContract` pe un
    // contract nedeterminat e o contradicție pe care serverul o respinge.
    ...(contract.durataDeterminata && contract.valabilPana !== null
      ? { dataSfarsitContract: ziCaMoment(contract.valabilPana) }
      : {}),
  };

  return {
    $type: "contract",
    header: construiesteAntet({ ...ctx, operatie }),
    ...(contract.regesContractId === null
      ? {}
      : { referintaContract: referinta(contract.regesContractId) }),
    continut,
  };
}

export function mapeazaIncetare(
  regesContractId: string,
  incetare: {
    readonly data: ZiIso;
    readonly temeiLegal: string;
    readonly explicatie: string | null;
  },
  ctx: Omit<ContextAntet, "operatie">,
): MesajContract {
  return {
    $type: "contract",
    header: construiesteAntet({ ...ctx, operatie: "IncetareContract" }),
    referintaContract: referinta(regesContractId),
    actiune: {
      $type: "actiuneIncetare",
      dataIncetare: ziCaMoment(incetare.data),
      temeiLegal: incetare.temeiLegal.trim(),
      ...(text(incetare.explicatie) === undefined
        ? {}
        : { explicatie: text(incetare.explicatie) as string }),
    },
  };
}

export function mapeazaSuspendare(
  regesContractId: string,
  suspendare: {
    readonly dataInceput: ZiIso;
    readonly dataSfarsit: ZiIso | null;
    readonly temeiLegal: string;
    readonly explicatie: string | null;
  },
  ctx: Omit<ContextAntet, "operatie">,
): MesajContract {
  return {
    $type: "contract",
    header: construiesteAntet({ ...ctx, operatie: "SuspendareContract" }),
    referintaContract: referinta(regesContractId),
    actiune: {
      $type: "actiuneSuspendare",
      dataInceput: ziCaMoment(suspendare.dataInceput),
      temeiLegal: suspendare.temeiLegal.trim(),
      ...(suspendare.dataSfarsit === null
        ? {}
        : { dataSfarsit: ziCaMoment(suspendare.dataSfarsit) }),
      ...(text(suspendare.explicatie) === undefined
        ? {}
        : { explicatie: text(suspendare.explicatie) as string }),
    },
  };
}

export function mapeazaReactivare(
  regesContractId: string,
  reactivare: { readonly data: ZiIso; readonly temeiLegal: string | null },
  ctx: Omit<ContextAntet, "operatie">,
): MesajContract {
  return {
    $type: "contract",
    header: construiesteAntet({ ...ctx, operatie: "ReactivareContract" }),
    referintaContract: referinta(regesContractId),
    actiune: {
      $type: "actiuneReactivare",
      dataReactivare: ziCaMoment(reactivare.data),
      ...(text(reactivare.temeiLegal) === undefined
        ? {}
        : { temeiLegal: text(reactivare.temeiLegal) as string }),
    },
  };
}

/** Ziua, verificată — folosită de apelanți care primesc text din bază. */
export const ziValidata = zi;
