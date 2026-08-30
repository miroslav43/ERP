// src/lib/reges/reconciliere.ts
import "server-only";

/**
 * Ciclul care ține coada REGES în mișcare: trimite ce e gata, culege ce a
 * răspuns Inspecția Muncii, împerechează rezultatele cu entitățile noastre.
 *
 * DE CE O ÎNCHIRIERE, ȘI NU DOAR UN CRON
 * Stack-ul rulează cu DOUĂ replici, iar cozile REGES sunt CONSUMATOARE: fiecare
 * citire avansează cursorul angajatorului. Două cicluri concurente pe același
 * `consumerId` ar consuma fiecare jumătate din mesaje și ar crede fiecare că
 * le-a văzut pe toate — rezultatele s-ar pierde tăcut, fără nicio eroare
 * nicăieri. Închirierea din `reges_inchiriere` e luată atomic, cu termen, deci
 * supraviețuiește și unei replici ucise la mijlocul ciclului.
 *
 * DE CE `ReadBatch` + `CommitReadBatch`, ȘI NU `PollMessage`
 * `PollMessage` citește ȘI avansează într-un singur apel: o cădere între citire
 * și scrierea în baza noastră pierde definitiv rezultatul. Perechea
 * citește-apoi-confirmă ne dă „cel puțin o dată" în loc de „cel mult o dată",
 * iar unicitatea pe `response_id` face reprocesarea inofensivă.
 *
 * ⚠ `CommitReadBatch` primește numărul REAL de mesaje întoarse (P), nu numărul
 * cerut (N). Confirmarea a N mesaje când serverul a dat P < N sare peste
 * mesajele necitite dintre ele.
 *
 * CE NU FACE CICLUL
 * Nu trimite mesaje de tip `salariat`. Acelea conțin CNP, iar decriptarea lui
 * trebuie să rămână pe drumul autorizat al utilizatorului, unde
 * `hr_read_sensitive` o auditează. Un contract nu conține date personale: îl
 * poate compune și trimite ciclul.
 */

import { mascheazaText, ultimele4 } from "@/domain/reges/mascare";
import { construiesteAntet, type RezultatMesaj } from "@/domain/reges/mesaj";
import { ziCaMoment } from "@/domain/reges/formate";
import type { Operatie } from "@/domain/reges/operatii";
import type { AdminSupabase } from "@/lib/supabase/admin";
import { cheamaReges, type Mediu } from "./client";
import { compuneContract, compuneIncetare, compuneReactivare, compuneSuspendare } from "./compune";
import { citesteCredentiale, type CredentialeReges } from "./credentiale";
import { jetonValid } from "./jeton";

export const CHEIE_INCHIRIERE = "reconciliere";
const SECUNDE_INCHIRIERE = 300;
/** Câte rezultate se cer odată. Plafonul serverului nu e documentat. */
const MESAJE_PE_LOT = 20;
const MAX_LOTURI = 10;
/** Câte mesaje trimite ciclul per firmă, ca o coadă mare să nu-l blocheze. */
const MAX_TRIMITERI = 25;

export type RaportOrganizatie = Readonly<{
  organizationId: string;
  trimise: number;
  rezultate: number;
  propuneri: number;
  eroare: string | null;
}>;

export type RaportCiclu = Readonly<{
  rulat: boolean;
  motiv?: string;
  organizatii: readonly RaportOrganizatie[];
}>;

// ── Închirierea ─────────────────────────────────────────────────────────────

export async function iaInchirierea(db: AdminSupabase, detinator: string): Promise<boolean> {
  const { data, error } = await db.rpc("reges_ia_inchirierea", {
    p_cheie: CHEIE_INCHIRIERE,
    p_detinator: detinator,
    p_secunde: SECUNDE_INCHIRIERE,
  });
  if (error !== null) throw error;
  return data === true;
}

export async function lasaInchirierea(db: AdminSupabase, detinator: string): Promise<void> {
  const { error } = await db.rpc("reges_lasa_inchirierea", {
    p_cheie: CHEIE_INCHIRIERE,
    p_detinator: detinator,
  });
  if (error !== null) throw error;
}

// ── Jurnalul apelurilor ─────────────────────────────────────────────────────

async function jurnalizeaza(
  db: AdminSupabase,
  input: {
    organizationId: string;
    mesajId: string | null;
    metoda: "GET" | "POST";
    cale: string;
    status: number | null;
    durataMs: number;
    consumerId: string;
    eroare: string | null;
  },
): Promise<void> {
  // Fără corpuri, niciodată: o cerere `Salariat` e, în întregime, dată personală.
  // `eroare` trece prin mascare — mesajele REGES conțin uneori CNP-ul refuzat.
  await db.from("reges_apeluri").insert({
    organization_id: input.organizationId,
    mesaj_id: input.mesajId,
    metoda: input.metoda,
    cale: input.cale,
    http_status: input.status,
    durata_ms: input.durataMs,
    consumer_id: input.consumerId,
    eroare: mascheazaText(input.eroare),
  });
}

// ── Trimiterea ──────────────────────────────────────────────────────────────

const SELECT_MESAJ =
  "id, organization_id, employee_id, contract_id, tip, operatie, message_id, depinde_de, incercari";

type MesajDeTrimis = Readonly<{
  id: string;
  organization_id: string;
  employee_id: string | null;
  contract_id: string | null;
  tip: string;
  operatie: string;
  message_id: string;
  depinde_de: string | null;
  incercari: number;
}>;

/** Identificatorul REGES al salariatului de care depinde mesajul, dacă e cazul. */
async function referintaSalariatPentru(
  db: AdminSupabase,
  mesaj: MesajDeTrimis,
): Promise<string | null> {
  if (mesaj.employee_id === null) return null;
  const { data } = await db
    .from("employees")
    .select("reges_salariat_id")
    .eq("id", mesaj.employee_id)
    .eq("organization_id", mesaj.organization_id)
    .maybeSingle();
  return data?.reges_salariat_id ?? null;
}

async function trimiteUnul(
  db: AdminSupabase,
  cred: CredentialeReges,
  jeton: string,
  mesaj: MesajDeTrimis,
  contextAntet: { autorId: string; sesiuneId: string; utilizator: string },
): Promise<boolean> {
  const regesSalariatId = await referintaSalariatPentru(db, mesaj);
  if (regesSalariatId === null) return false; // dependența n-a sosit încă

  // `reges_mesaje.contract_id` e nullable. Golit cu `?? ""`, ajungea la o
  // coloană `uuid` și ridica 22P02, iar mesajul era marcat „Contractul legat de
  // mesaj nu mai există" — o explicație falsă pentru un mesaj fără contract
  // atașat. Rezultatul e același (eșec neretransmis), motivul scris în jurnal
  // nu era. Poarta: `src/config/filtru-gol.test.ts`.
  if (mesaj.contract_id === null) {
    await marcheazaEsec(db, mesaj.id, "Mesajul nu are un contract atașat.");
    return false;
  }

  const { data: contract } = await db
    .from("employment_contracts")
    // prettier-ignore
    .select(
      "numar, data_contract, valabil_de_la, valabil_pana, contract_duration, norma_ore_saptamana, norma_ore_zi, salariu_baza, moneda, work_mode, special_regime, reges_contract_id, reges_tip_contract, reges_tip_norma, reges_norma_timp, reges_repartizare, temei_incetare, reges_temei_incetare, incetat_la, functie, cod_cor",
    )
    .eq("id", mesaj.contract_id)
    .eq("organization_id", mesaj.organization_id)
    .maybeSingle();

  if (contract === null) {
    await marcheazaEsec(db, mesaj.id, "Contractul legat de mesaj nu mai există.");
    return false;
  }

  const ctx = { messageId: mesaj.message_id, ...contextAntet };
  // `cod_cor` e deja pe rând: nu se mai împrumută din nomenclator prin embed.
  const rand = contract;

  let corp: unknown;
  if (mesaj.operatie === "AdaugareContract" || mesaj.operatie === "ModificareContract") {
    const compus = compuneContract(rand, regesSalariatId, {
      ...ctx,
      operatie: mesaj.operatie,
    });
    if (!compus.ok) {
      await marcheazaEsec(
        db,
        mesaj.id,
        compus.probleme.map((p) => `${p.camp}: ${p.mesaj}`).join(" · "),
      );
      return false;
    }
    corp = compus.mesaj;
  } else if (mesaj.operatie === "IncetareContract") {
    if (contract.reges_contract_id === null || contract.incetat_la === null) {
      await marcheazaEsec(
        db,
        mesaj.id,
        "Contractul nu are dată de încetare sau identificator REGES.",
      );
      return false;
    }
    corp = compuneIncetare(
      contract.reges_contract_id,
      {
        data: contract.incetat_la,
        temeiLegal: contract.reges_temei_incetare ?? contract.temei_incetare ?? "",
        explicatie: null,
      },
      ctx,
    );
  } else if (mesaj.operatie === "SuspendareContract" || mesaj.operatie === "ReactivareContract") {
    const { data: suspendare } = await db
      .from("contract_suspendari")
      .select("data_inceput, data_sfarsit, temei_legal, explicatie")
      .eq("contract_id", mesaj.contract_id)
      .eq("organization_id", mesaj.organization_id)
      .eq("stare", "activa")
      .is("deleted_at", null)
      .order("data_inceput", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (suspendare === null || contract.reges_contract_id === null) {
      await marcheazaEsec(
        db,
        mesaj.id,
        "Nu există o suspendare activă de transmis pentru contract.",
      );
      return false;
    }
    corp =
      mesaj.operatie === "SuspendareContract"
        ? compuneSuspendare(
            contract.reges_contract_id,
            {
              dataInceput: suspendare.data_inceput,
              dataSfarsit: suspendare.data_sfarsit,
              temeiLegal: suspendare.temei_legal,
              explicatie: suspendare.explicatie,
            },
            ctx,
          )
        : compuneReactivare(
            contract.reges_contract_id,
            {
              data: suspendare.data_sfarsit ?? suspendare.data_inceput,
              temeiLegal: suspendare.temei_legal,
            },
            ctx,
          );
  } else if (mesaj.tip === "propunere_detasare" || mesaj.tip === "propunere_mutare") {
    // Datele propunerii nu sunt pe contract — CUI-ul destinației, perioada și
    // temeiul le introduce operatorul, iar acțiunea le-a scris în `reges_propuneri`.
    const { data: propunere } = await db
      .from("reges_propuneri")
      .select("reges_contract_id, angajator_partener_cui, data_inceput, data_sfarsit, temei_legal")
      .eq("mesaj_id", mesaj.id)
      .eq("organization_id", mesaj.organization_id)
      .maybeSingle();
    if (propunere === null || propunere.reges_contract_id === null) {
      await marcheazaEsec(
        db,
        mesaj.id,
        "Propunerea legată de mesaj nu mai există sau e incompletă.",
      );
      return false;
    }
    corp = {
      $type:
        mesaj.tip === "propunere_mutare" ? "propunereMutareContract" : "propunereDetasareContract",
      header: construiesteAntet({ ...ctx, operatie: mesaj.operatie as Operatie }),
      referintaContract: { $type: "referinta", id: propunere.reges_contract_id },
      dataInceput: ziCaMoment(propunere.data_inceput ?? ""),
      ...(propunere.data_sfarsit === null
        ? {}
        : { dataSfarsit: ziCaMoment(propunere.data_sfarsit) }),
      ...(propunere.temei_legal === null ? {} : { temeiLegal: propunere.temei_legal }),
      ...(propunere.angajator_partener_cui === null
        ? {}
        : { cuiAngajatorDestinatie: propunere.angajator_partener_cui }),
    };
  } else {
    return false;
  }

  // Propunerile au propriul endpoint; restul merg pe `/api/Contract`.
  const cale =
    mesaj.tip === "propunere_detasare"
      ? "/api/Detasare/Propuneri"
      : mesaj.tip === "propunere_mutare"
        ? "/api/Mutare/Propuneri"
        : "/api/Contract";
  const raspuns = await cheamaReges<{ responseId?: string }>({
    mediu: cred.mediu as Mediu,
    cale,
    metoda: "POST",
    jeton,
    // `consumerId` e cerut pe endpoint-urile de propuneri, ignorat pe `/api/Contract`.
    parametri: { consumerId: cred.consumerId },
    corp,
  });

  await jurnalizeaza(db, {
    organizationId: cred.organizationId,
    mesajId: mesaj.id,
    metoda: "POST",
    cale,
    status: raspuns.status,
    durataMs: raspuns.durataMs,
    consumerId: cred.consumerId,
    eroare: raspuns.ok ? null : raspuns.mesaj,
  });

  if (!raspuns.ok) {
    // Un 400 nu se reîncearcă: același mesaj primește același refuz.
    if (raspuns.motiv === "validare") {
      await marcheazaEsec(db, mesaj.id, raspuns.mesaj, raspuns.status);
      return false;
    }
    await db
      .from("reges_mesaje")
      .update({
        incercari: mesaj.incercari + 1,
        urmatoarea_incercare_la: new Date(Date.now() + 10 * 60_000).toISOString(),
        eroare: mascheazaText(raspuns.mesaj),
        http_status: raspuns.status,
      })
      .eq("id", mesaj.id);
    return false;
  }

  const responseId = raspuns.date?.responseId ?? null;
  await db
    .from("reges_mesaje")
    .update({
      stare: "asteapta_raspuns",
      response_id: responseId,
      trimis_la: new Date().toISOString(),
      incercari: mesaj.incercari + 1,
      http_status: raspuns.status,
      eroare: null,
    })
    .eq("id", mesaj.id);
  return true;
}

async function marcheazaEsec(
  db: AdminSupabase,
  mesajId: string,
  motiv: string,
  status: number | null = null,
): Promise<void> {
  await db
    .from("reges_mesaje")
    .update({
      stare: "esuat",
      trimis_la: new Date().toISOString(),
      eroare: mascheazaText(motiv),
      http_status: status,
    })
    .eq("id", mesajId);
}

async function trimiteMesajeleGata(
  db: AdminSupabase,
  cred: CredentialeReges,
  jeton: string,
): Promise<number> {
  const acum = new Date().toISOString();
  const { data, error } = await db
    .from("reges_mesaje")
    .select(SELECT_MESAJ)
    .eq("organization_id", cred.organizationId)
    .eq("stare", "de_transmis")
    // Mesajele de salariat conțin CNP: pleacă doar din Server Action, sub
    // permisiunile omului, unde citirea CNP-ului se auditează. Contractele și
    // propunerile nu conțin date personale — pe acelea le duce ciclul.
    .neq("tip", "salariat")
    .or(`urmatoarea_incercare_la.is.null,urmatoarea_incercare_la.lte.${acum}`)
    .is("deleted_at", null)
    // FIFO: REGES procesează în ordinea sosirii, iar o modificare ajunsă
    // înaintea adăugării e respinsă ca referință inexistentă.
    .order("ordine", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(MAX_TRIMITERI);
  if (error !== null) throw error;

  const context = {
    autorId: "00000000-0000-0000-0000-000000000000",
    sesiuneId: crypto.randomUUID(),
    utilizator: "Reconciliere automată",
  };

  let trimise = 0;
  for (const mesaj of data ?? []) {
    if (await trimiteUnul(db, cred, jeton, mesaj as MesajDeTrimis, context)) trimise += 1;
  }
  return trimise;
}

// ── Culegerea rezultatelor ──────────────────────────────────────────────────

/**
 * Aplică un `MessageResult` peste mesajul nostru și peste entitatea atinsă.
 *
 * IDEMPOTENTĂ: un mesaj deja ajuns în `reusit` sau `esuat` nu se mai atinge.
 * Fără gardă, o recitire a aceluiași lot — normală, fiindcă protocolul e „cel
 * puțin o dată" — ar suprascrie un rezultat cu el însuși și ar rescrie
 * `raspuns_la`, făcând istoricul de nedescifrat.
 */
async function aplicaRezultat(
  db: AdminSupabase,
  organizationId: string,
  r: RezultatMesaj,
): Promise<boolean> {
  const responseId = r.responseId;
  if (typeof responseId !== "string" || responseId === "") return false;

  const { data: mesaj } = await db
    .from("reges_mesaje")
    .select("id, tip, stare, employee_id, contract_id")
    .eq("organization_id", organizationId)
    .eq("response_id", responseId)
    .maybeSingle();
  if (mesaj === null) return false;
  if (mesaj.stare === "reusit" || mesaj.stare === "esuat") return false;

  const reusit = r.result.code === "SUCCES";
  const ref = typeof r.result.ref === "string" && r.result.ref !== "" ? r.result.ref : null;

  await db
    .from("reges_mesaje")
    .update({
      stare: reusit && ref !== null ? "reusit" : "esuat",
      raspuns_la: new Date().toISOString(),
      rezultat_cod: r.result.code,
      rezultat_tip: r.result.codeType,
      rezultat_mesaj: mascheazaText(r.result.description ?? null),
      referinta_id: ref,
      referinta_sec_id: typeof r.result.secRef === "string" ? r.result.secRef : null,
      asteapta_rezultate_conexe: r.result.relatedResultsExpected === true,
      ...(reusit && ref === null
        ? {
            eroare:
              "Inspecția Muncii a raportat succes fără să întoarcă identificatorul entității.",
          }
        : { eroare: null }),
    })
    .eq("id", mesaj.id);

  // Identificatorul REGES se scrie PERMANENT pe entitate: toate operațiile
  // ulterioare merg prin referință, nu prin retrimiterea datelor.
  if (reusit && ref !== null) {
    if (mesaj.tip === "salariat" && mesaj.employee_id !== null) {
      await db
        .from("employees")
        .update({ reges_salariat_id: ref })
        .eq("id", mesaj.employee_id)
        .eq("organization_id", organizationId)
        .is("reges_salariat_id", null);
    }
    if (mesaj.tip === "contract" && mesaj.contract_id !== null) {
      await db
        .from("employment_contracts")
        .update({ reges_contract_id: ref })
        .eq("id", mesaj.contract_id)
        .eq("organization_id", organizationId)
        .is("reges_contract_id", null);
    }
  }
  return true;
}

async function culegeRezultate(
  db: AdminSupabase,
  cred: CredentialeReges,
  jeton: string,
): Promise<number> {
  let total = 0;
  for (let lot = 0; lot < MAX_LOTURI; lot += 1) {
    const citire = await cheamaReges<readonly RezultatMesaj[]>({
      mediu: cred.mediu as Mediu,
      cale: "/api/Status/ReadBatch",
      metoda: "POST",
      jeton,
      parametri: { consumerId: cred.consumerId },
      corp: { messages: MESAJE_PE_LOT },
    });

    await jurnalizeaza(db, {
      organizationId: cred.organizationId,
      mesajId: null,
      metoda: "POST",
      cale: "/api/Status/ReadBatch",
      status: citire.status,
      durataMs: citire.durataMs,
      consumerId: cred.consumerId,
      eroare: citire.ok ? null : citire.mesaj,
    });

    if (!citire.ok) break;
    const rezultate = Array.isArray(citire.date) ? citire.date : [];
    if (rezultate.length === 0) break;

    for (const r of rezultate) {
      if (await aplicaRezultat(db, cred.organizationId, r)) total += 1;
    }

    // ⚠ Numărul REAL întors, nu cel cerut. Confirmarea a 20 când serverul a dat
    // 7 ar sări peste 13 mesaje necitite.
    await cheamaReges({
      mediu: cred.mediu as Mediu,
      cale: "/api/Status/CommitReadBatch",
      metoda: "POST",
      jeton,
      parametri: { consumerId: cred.consumerId },
      corp: { messages: rezultate.length },
    });

    if (rezultate.length < MESAJE_PE_LOT) break;
  }
  return total;
}

// ── Propunerile de detașare și de mutare ────────────────────────────────────

/**
 * Forma unei propuneri, așa cum vine din coada REGES.
 *
 * Documentația nu descrie corpul, iar XSD-ul dă numele XML. Se citesc tolerant
 * ambele scrieri, se păstrează doar ce înțelegem, și se ignoră restul — o
 * propunere care nu se poate citi nu trebuie să oprească celelalte.
 */
type PropunereBruta = Readonly<Record<string, unknown>>;

const sir = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

function citesteCamp(p: PropunereBruta, ...chei: readonly string[]): string | null {
  for (const cheie of chei) {
    const valoare = sir(p[cheie]);
    if (valoare !== null) return valoare;
  }
  return null;
}

/**
 * Cele PATRU cozi de propuneri.
 *
 * README-ul oficial le confundă într-una singură. Swagger-ul arată că sunt
 * distincte: `Propuneri` (trimise de noi) și `PropuneriPrimite` (venite spre
 * noi), pe fiecare dintre `Detasare` și `Mutare`. Fiecare are propriul cursor,
 * deci un ciclu care citește doar una pierde tăcut trei sferturi din mesaje.
 */
const COZI_PROPUNERI = [
  { cale: "/api/Detasare/Propuneri", fel: "detasare", directie: "trimisa" },
  { cale: "/api/Detasare/PropuneriPrimite", fel: "detasare", directie: "primita" },
  { cale: "/api/Mutare/Propuneri", fel: "mutare", directie: "trimisa" },
  { cale: "/api/Mutare/PropuneriPrimite", fel: "mutare", directie: "primita" },
] as const;

async function culegePropuneri(
  db: AdminSupabase,
  cred: CredentialeReges,
  jeton: string,
): Promise<number> {
  let total = 0;

  for (const coada of COZI_PROPUNERI) {
    for (let lot = 0; lot < MAX_LOTURI; lot += 1) {
      const cale = `${coada.cale}/ReadBatch`;
      const citire = await cheamaReges<readonly PropunereBruta[]>({
        mediu: cred.mediu as Mediu,
        cale,
        metoda: "POST",
        jeton,
        parametri: { consumerId: cred.consumerId },
        corp: { messages: MESAJE_PE_LOT },
      });

      await jurnalizeaza(db, {
        organizationId: cred.organizationId,
        mesajId: null,
        metoda: "POST",
        cale,
        status: citire.status,
        durataMs: citire.durataMs,
        consumerId: cred.consumerId,
        eroare: citire.ok ? null : citire.mesaj,
      });

      if (!citire.ok) break;
      const propuneri = Array.isArray(citire.date) ? citire.date : [];
      if (propuneri.length === 0) break;

      for (const bruta of propuneri) {
        const regesId = citesteCamp(bruta, "id", "Id", "propunereId", "PropunereId");
        if (regesId === null) continue;

        // Unicitatea pe `(organization_id, reges_propunere_id)` face recitirea
        // inofensivă — protocolul e „cel puțin o dată", nu „exact o dată".
        const { data: existenta } = await db
          .from("reges_propuneri")
          .select("id")
          .eq("organization_id", cred.organizationId)
          .eq("reges_propunere_id", regesId)
          .maybeSingle();
        if (existenta !== null) continue;

        const cnp = citesteCamp(bruta, "cnp", "Cnp");
        const { error } = await db.from("reges_propuneri").insert({
          organization_id: cred.organizationId,
          directie: coada.directie,
          fel: coada.fel,
          reges_propunere_id: regesId,
          reges_contract_id: citesteCamp(bruta, "contractId", "ContractId"),
          angajator_partener_cui: citesteCamp(bruta, "cuiAngajator", "CuiAngajator", "cui"),
          angajator_partener_nume: citesteCamp(bruta, "numeAngajator", "NumeAngajator", "denumire"),
          salariat_nume: citesteCamp(bruta, "numeSalariat", "NumeSalariat", "nume"),
          // CNP-ul unui om care nu e (încă) angajatul nostru se păstrează DOAR
          // mascat: o fișă de date personale în afara `employee_sensitive_data`
          // n-ar avea nici cheia, nici auditul ei.
          salariat_cnp_last4: cnp === null ? null : (ultimele4(cnp) ?? null),
          data_inceput: citesteCamp(bruta, "dataInceput", "DataInceput")?.slice(0, 10) ?? null,
          data_sfarsit: citesteCamp(bruta, "dataSfarsit", "DataSfarsit")?.slice(0, 10) ?? null,
          temei_legal: citesteCamp(bruta, "temeiLegal", "TemeiLegal"),
          stare: "noua",
          primita_la: new Date().toISOString(),
        });
        if (error === null) total += 1;
      }

      // Numărul REAL primit, nu cel cerut.
      await cheamaReges({
        mediu: cred.mediu as Mediu,
        cale: `${coada.cale}/CommitReadBatch`,
        metoda: "POST",
        jeton,
        parametri: { consumerId: cred.consumerId },
        corp: { messages: propuneri.length },
      });

      if (propuneri.length < MESAJE_PE_LOT) break;
    }
  }

  return total;
}

// ── Ciclul ──────────────────────────────────────────────────────────────────

async function organizatiiActive(db: AdminSupabase): Promise<readonly string[]> {
  const { data, error } = await db
    .from("reges_credentiale")
    .select("organization_id")
    .eq("activ", true)
    .is("deleted_at", null);
  if (error !== null) throw error;
  return (data ?? []).map((r) => r.organization_id);
}

async function ruleazaPentruOrganizatie(
  db: AdminSupabase,
  organizationId: string,
): Promise<RaportOrganizatie> {
  const gol = { organizationId, trimise: 0, rezultate: 0, propuneri: 0 };
  try {
    const cred = await citesteCredentiale(db, organizationId);
    if (cred === null) {
      return { ...gol, eroare: "Configurarea REGES e incompletă: lipsesc cheile API." };
    }

    const jeton = await jetonValid(db, cred);
    if (!jeton.ok) {
      await db
        .from("reges_credentiale")
        .update({
          verificat_la: new Date().toISOString(),
          verificat_ok: false,
          verificat_mesaj: jeton.mesaj,
        })
        .eq("organization_id", organizationId);
      return { ...gol, eroare: jeton.mesaj };
    }

    const trimise = await trimiteMesajeleGata(db, cred, jeton.jeton);
    const rezultate = await culegeRezultate(db, cred, jeton.jeton);
    const propuneri = await culegePropuneri(db, cred, jeton.jeton);
    return { organizationId, trimise, rezultate, propuneri, eroare: null };
  } catch (eroare) {
    // O firmă cu o configurare stricată nu are voie să oprească celelalte firme.
    return {
      ...gol,
      eroare: mascheazaText(eroare instanceof Error ? eroare.message : String(eroare)),
    };
  }
}

export async function ruleazaCiclu(db: AdminSupabase, detinator: string): Promise<RaportCiclu> {
  if (!(await iaInchirierea(db, detinator))) {
    return {
      rulat: false,
      motiv: "Un alt ciclu de reconciliere e deja în curs.",
      organizatii: [],
    };
  }

  try {
    const organizatii = await organizatiiActive(db);
    const rapoarte: RaportOrganizatie[] = [];
    for (const organizationId of organizatii) {
      rapoarte.push(await ruleazaPentruOrganizatie(db, organizationId));
    }
    return { rulat: true, organizatii: rapoarte };
  } finally {
    await lasaInchirierea(db, detinator);
  }
}
