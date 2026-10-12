// src/app/(app)/flota/erori.ts
// Traducerea codurilor Postgres specifice flotei — separat de traducerea
// generică din `src/lib/actions/errors.ts`, ca fiecare modul să-și scrie
// mesajele fără să atingă un fișier comun.

import { businessRule, invalidInput, isPostgrestError } from "@/lib/actions/errors";
import { cuVirgula } from "@/lib/text/diacritice";

/**
 * Traduce o eroare Postgres într-un mesaj de business afișabil ca atare.
 *
 * Cazul care contează cel mai mult e P0001. Triggerele din 0012 și 0018 ridică
 * mesaje deja scrise pentru utilizator final, cu CIFRELE în ele:
 *
 *   „Kilometrajul de plecare (9000 km) este mai mic decât ultimul kilometraj
 *    cunoscut al vehiculului (10000 km)…"
 *
 * Fără propagare, `mapPostgrestError` le-ar înlocui cu „Operațiunea a fost
 * respinsă de o regulă a sistemului" — iar șoferul n-ar afla CE km să corecteze.
 * De aceea mesajul se propagă, nu se rescrie: cifrele din el se pot afla doar
 * din bază. Singura atingere e `cuVirgula` — sedila din migrările vechi devine
 * virgula dedesubt (QA ADM-021).
 *
 * Tip `never`: apelul întrerupe fluxul exact ca un `throw`, deci TypeScript
 * îngustează corect tipul lui `data` imediat după.
 */
export function traduEroare(error: unknown): never {
  if (isPostgrestError(error)) {
    if (error.code === "23505") {
      const unicitate = UNICITATI.find(([index]) => error.message.includes(index));
      if (unicitate !== undefined) {
        const [, camp, mesaj] = unicitate;
        throw invalidInput(mesaj, { [camp]: [mesaj] });
      }
      // `vehicles_org_nr_uq` sau `vehicles_org_vin_uq`. Ambele se aplică peste
      // valoarea NORMALIZATĂ de trigger, deci mesajul nu poate cita ce a scris
      // utilizatorul — ar fi diferit de ce a ajuns în index.
      throw businessRule(
        "Există deja un vehicul cu acest număr de înmatriculare sau cu acest VIN în organizație.",
      );
    }
    if (error.code === "22012" || error.code === "22003") {
      throw businessRule(
        "O valoare numerică este în afara intervalului acceptat. Verificați kilometrajul, litrii și costul.",
      );
    }
    if (error.code === "P0001") {
      // Mesajele vechi din bază (0012/0018/0172) au ş/ţ cu sedilă. Nu se
      // retranscriu funcțiile ca să le corecteze — se corectează la afișare.
      const mesaj = cuVirgula(error.message.slice(0, 300));
      const campuri = campurileMesajului(mesaj);
      if (campuri.length > 0) {
        throw invalidInput(mesaj, Object.fromEntries(campuri.map((c) => [c, [mesaj]])));
      }
      throw businessRule(mesaj);
    }
  }
  throw error;
}

/**
 * Unicitățile din 0012/0200 care NU sunt despre vehicul. Fără ele, orice 23505
 * pe flotă ajungea „Există deja un vehicul cu acest număr…” — și pentru a doua
 * foaie a zilei, și pentru un bon trecut de două ori. Numele indexului apare în
 * mesajul Postgres, deci potrivirea e pe el.
 */
const UNICITATI: readonly (readonly [string, string, string])[] = [
  [
    "ts_vehicul_zi_uq",
    "plecare_la",
    "Vehiculul are deja o foaie de parcurs în ziua aceasta. Deschideți-o și adăugați cursa acolo.",
  ],
  ["fuel_bon_uq", "numar_bon", "Bonul acesta este deja trecut pe foaie."],
  ["trt_org_denumire_uq", "denumire", "Există deja un șablon de traseu cu acest nume."],
];

/**
 * Câmpul (sau câmpurile) de care ține un refuz al triggerelor de flotă, după
 * începutul mesajului. Cu el, eroarea ajunge ÎN caseta vinovată, înroșită, nu
 * într-un banner deasupra formularului. Mesajele din bază (0012/0018) sunt
 * scrise cu ş/ţ cu sedilă; potrivirea ocolește literele acelea (rulează după
 * `cuVirgula`, dar tiparele rămân valabile pentru ambele forme).
 */
const CAMPURI_DUPA_MESAJ: readonly (readonly [RegExp, readonly string[]])[] = [
  [/^Kilometrajul de sosire/u, ["km_sosire"]],
  [/^Kilometrajul de plecare/u, ["km_plecare"]],
  [/^Ora de sosire/u, ["sosire_la"]],
  [/^Completa.i ora .i kilometrajul de sosire/u, ["sosire_la", "km_sosire"]],
  [/^Data aliment/u, ["alimentat_la"]],
  [/^Cantitatea de combustibil/u, ["litri"]],
  [/^Vehiculul/u, ["vehicle_id"]],
  [/^.oferul selectat/u, ["employee_id"]],
  // 0199 §C3: mutarea foii pe un șofer pentru care apelantul n-are drept de
  // scriere. Niciun ecran nu mută azi o foaie; tiparul e aici ca un viitor
  // formular de corectură să primească mesajul pe câmp, nu sub buton.
  [/^Foaia se poate muta doar pe un șofer/u, ["employee_id"]],
  // 0200, cursele foii zilnice. Mesajele noi au ș/ț corecte.
  [/^Scrieți locul de plecare al cursei/u, ["de_la_loc"]],
  [/^Scrieți locul de sosire al cursei/u, ["pana_la_loc"]],
  [/^Scrieți scopul cursei/u, ["scop"]],
  [/^Sosirea cursei se completează întreagă/u, ["sosire_la", "km_sosire"]],
  [/^Sosirea cursei lipsește/u, ["sosire_la"]],
  [/^Ora de sosire a cursei/u, ["sosire_la"]],
  [/^Ora de plecare a cursei/u, ["plecare_la"]],
  [/^Kilometrajul la sosirea cursei/u, ["km_sosire"]],
];

function campurileMesajului(mesaj: string): readonly string[] {
  return CAMPURI_DUPA_MESAJ.find(([re]) => re.test(mesaj))?.[1] ?? [];
}

/**
 * Traducerea pentru alocări (0173), separată de cea a foilor.
 *
 * În caseta de predare, vehiculul e un câmp ASCUNS. Harta de mai sus ar pune
 * „Vehiculul …” pe `vehicle_id`, adică pe o casetă care nu se vede, iar
 * mesajul s-ar pierde sub „Corectați câmpurile marcate”. Aici, ce nu ține de un
 * câmp vizibil rămâne mesaj general. Mesajele din 0173 sunt scrise cu ș/ț
 * corecte, deci tiparele le folosesc direct.
 */
const CAMPURI_ALOCARE: readonly (readonly [RegExp, readonly string[]])[] = [
  [/^Alocarea începe/u, ["de_la"]],
  [/^Alocarea se încheie/u, ["pana_la"]],
  [/^Angajatul ales/u, ["employee_id"]],
];

export function traduEroareAlocare(error: unknown): never {
  if (isPostgrestError(error)) {
    if (error.code === "23P01") {
      // `va_fara_suprapunere`. `details` conține uuid-urile și intervalele brute,
      // inutile pentru om, deci nu se propagă.
      throw invalidInput(
        "Vehiculul era deja alocat cuiva în acest interval. Alegeți alt moment al predării.",
        {
          de_la: [
            "Vehiculul era deja alocat cuiva în acest interval. Alegeți alt moment al predării.",
          ],
        },
      );
    }
    if (error.code === "23514") {
      // Predarea închide alocarea deschisă cu `km_restituire = km_predare` nou.
      // Dacă cifra e sub kilometrajul predării anterioare, cade `va_km_ck`, iar
      // caseta precompletează `km_curent`, care poate rămâne în urmă. Cheia e
      // pusă pe ambele câmpuri de km: fiecare casetă îl are pe al ei vizibil.
      if (error.message.includes("va_km_ck")) {
        const mesaj =
          "Kilometrajul e mai mic decât cel de la predarea anterioară. Verificați cifra de la bord.";
        throw invalidInput(mesaj, { km_predare: [mesaj], km_restituire: [mesaj] });
      }
      if (error.message.includes("va_interval_ck")) {
        const mesaj = "Restituirea trebuie să fie după momentul predării.";
        throw invalidInput(mesaj, { pana_la: [mesaj] });
      }
    }
    if (error.code === "P0001") {
      // Mesajele vechi din bază (0012/0018/0172) au ş/ţ cu sedilă. Nu se
      // retranscriu funcțiile ca să le corecteze — se corectează la afișare.
      const mesaj = cuVirgula(error.message.slice(0, 300));
      const campuri = CAMPURI_ALOCARE.find(([re]) => re.test(mesaj))?.[1] ?? [];
      if (campuri.length > 0) {
        throw invalidInput(mesaj, Object.fromEntries(campuri.map((c) => [c, [mesaj]])));
      }
      throw businessRule(mesaj);
    }
  }
  traduEroare(error);
}

/**
 * Traducerea pentru setările flotei (0201). Mesajele triggerului au ș/ț
 * corecte. `fleet_settings_org_uq` înseamnă că două salvări au pornit amândouă
 * de la „firma n-are încă setări”: a doua nu se rescrie peste prima, omul
 * reîncarcă și vede ce s-a salvat.
 */
export function traduEroareSetari(error: unknown): never {
  if (isPostgrestError(error)) {
    if (error.code === "23505" && error.message.includes("fleet_settings_org_uq")) {
      throw businessRule(
        "Setările flotei au fost salvate între timp de altcineva. Reîncărcați pagina și reluați modificarea.",
      );
    }
    if (error.code === "23514") {
      // Schema le prinde înaintea bazei; ajung aici doar dacă limitele diverg.
      if (error.message.includes("fleet_settings_prag_salt_ck")) {
        const mesaj = "Pragul de salt e între 50 și 100.000 km.";
        throw invalidInput(mesaj, { prag_salt_km: [mesaj] });
      }
      if (error.message.includes("fleet_settings_praguri_ck")) {
        const mesaj = "Pragurile de alertă sunt între 1 și 365 de zile, cel mult 8.";
        throw invalidInput(mesaj, { praguri_alerta_zile: [mesaj] });
      }
      if (error.message.includes("fleet_settings_responsabili_ck")) {
        const mesaj = "Alegeți cel mult 20 de responsabili.";
        throw invalidInput(mesaj, { responsabili: [mesaj] });
      }
    }
    if (error.code === "P0001" && /^Responsabilul de flotă/u.test(error.message)) {
      const mesaj = error.message.slice(0, 300);
      throw invalidInput(mesaj, { responsabili: [mesaj] });
    }
  }
  traduEroare(error);
}

/**
 * Traducerea pentru nomenclatorul firmei (0202): tipurile proprii și setarea pe
 * tipurile de platformă. Mesajele noi au ș/ț corecte; cel din 0018 §F6
 * („Codul … Alegeţi alt cod”) e cu sedilă, deci tiparul ocolește litera.
 */
export function traduEroareTipuri(error: unknown): never {
  if (isPostgrestError(error)) {
    if (error.code === "23505" && error.message.includes("vdt_org_cod_uq")) {
      const mesaj = "Firma are deja un tip de document cu această denumire.";
      throw invalidInput(mesaj, { denumire: [mesaj] });
    }
    if (error.code === "23505" && error.message.includes("vdts_org_tip_uq")) {
      throw businessRule(
        "Setarea tipului a fost salvată între timp de altcineva. Reîncărcați pagina și reluați modificarea.",
      );
    }
    if (error.code === "23514") {
      if (error.message.includes("vdt_masa_ck")) {
        const mesaj = "Masa se scrie în kg întregi, între 1 și 100.000.";
        throw invalidInput(mesaj, { masa_max_kg: [mesaj] });
      }
      if (error.message.includes("vdt_denumire_len")) {
        const mesaj = "Denumirea are între 2 și 120 de caractere.";
        throw invalidInput(mesaj, { denumire: [mesaj] });
      }
    }
    if (error.code === "P0001" && /^Codul „/u.test(error.message)) {
      const mesaj =
        "Denumirea se suprapune cu un tip din nomenclatorul comun. Activați-l pe acela sau alegeți altă denumire.";
      throw invalidInput(mesaj, { denumire: [mesaj] });
    }
  }
  traduEroare(error);
}

// ═══ ÎNCEPUT BLOC: service, costuri, anvelope (0203) ═════════════════════════

/**
 * Traducerea pentru planuri de service, intervenții și cheltuieli (0203).
 *
 * În casetele de service vehiculul e un câmp ASCUNS (fișa îl știe), deci
 * „Vehiculul ales nu există…” rămâne mesaj general, nu o eroare pe un câmp care
 * nu se vede — aceeași capcană ca la alocări. Mesajele noi au ș/ț corecte.
 */
const CAMPURI_SERVICE: readonly (readonly [RegExp, readonly string[]])[] = [
  [/^Data ultimei intervenții/u, ["baza_data"]],
  [/^Planul ales nu aparține/u, ["plan_id"]],
  [/^Data intervenției/u, ["data_interventiei"]],
  [/^Data cheltuielii/u, ["data_cheltuielii"]],
];

/** Câmpul (câmpurile) unui CHECK al celor trei tabele, după numele constrângerii din mesaj. */
const CHECK_SERVICE: readonly (readonly [string, string, string])[] = [
  ["vsp_interval_ck", "interval_km", "Alegeți cel puțin un interval: în kilometri sau în luni."],
  [
    "vse_anvelope_ck",
    "anvelope_montate",
    "Anvelopele montate se aleg doar la o intervenție de tip „Anvelope”.",
  ],
  [
    "vex_litri_ck",
    "litri",
    "Litrii se completează doar la „Combustibil fără foaie”, și trebuie să fie pozitivi.",
  ],
  ["vex_suma_ck", "suma", "Suma trebuie să fie mai mare decât zero."],
  ["vse_costuri_ck", "cost_piese", "Costurile nu pot fi negative."],
];

export function traduEroareService(error: unknown): never {
  if (isPostgrestError(error)) {
    if (error.code === "23505" && error.message.includes("vsp_vehicul_denumire_uq")) {
      const mesaj = "Vehiculul are deja un plan cu această denumire.";
      throw invalidInput(mesaj, { denumire: [mesaj] });
    }
    if (error.code === "23514") {
      const check = CHECK_SERVICE.find(([nume]) => error.message.includes(nume));
      if (check !== undefined) {
        const [, camp, mesaj] = check;
        throw invalidInput(mesaj, { [camp]: [mesaj] });
      }
    }
    if (error.code === "P0001") {
      const mesaj = error.message.slice(0, 300);
      const campuri = CAMPURI_SERVICE.find(([re]) => re.test(mesaj))?.[1] ?? [];
      if (campuri.length > 0) {
        throw invalidInput(mesaj, Object.fromEntries(campuri.map((c) => [c, [mesaj]])));
      }
      throw businessRule(mesaj);
    }
  }
  traduEroare(error);
}
// ═══ SFÂRȘIT BLOC: service, costuri, anvelope (0203) ══════════════════════════

// ── ÎNCEPUT BLOC: permisele șoferilor și foaia legată de deplasare (0204, F9) ──

/**
 * Refuzurile triggerului `internal.permise_inainte` (0204), pe câmpul lor.
 * Mesajele sunt scrise cu ș/ț corecte, deci tiparele le folosesc direct.
 */
const CAMPURI_PERMIS: readonly (readonly [RegExp, readonly string[]])[] = [
  [/^Categoria „/u, ["categorii"]],
  [/^Alegeți cel puțin o categorie/u, ["categorii"]],
  [/^Numărul permisului/u, ["numar"]],
  [/^Data eliberării permisului/u, ["eliberat_la"]],
];

export function traduEroarePermis(error: unknown): never {
  if (isPostgrestError(error)) {
    if (error.code === "23505" && error.message.includes("driver_licenses_angajat_uq")) {
      throw businessRule(
        "Angajatul are deja un permis de conducere înregistrat. Reînnoirea se face pe același permis: modificați-l.",
      );
    }
    if (error.code === "23503" && error.message.includes("driver_licenses_angajat_fk")) {
      throw businessRule("Angajatul ales nu aparține organizației dumneavoastră.");
    }
    if (error.code === "23514") {
      if (error.message.includes("driver_licenses_interval_ck")) {
        const mesaj = "Valabilitatea permisului nu se poate încheia înainte de data eliberării.";
        throw invalidInput(mesaj, { expira_la: [mesaj] });
      }
      if (error.message.includes("driver_licenses_categorii_ck")) {
        const mesaj = "Una dintre categorii nu există pe permisul de conducere românesc.";
        throw invalidInput(mesaj, { categorii: [mesaj] });
      }
    }
    if (error.code === "P0001") {
      const mesaj = error.message.slice(0, 300);
      const campuri = CAMPURI_PERMIS.find(([re]) => re.test(mesaj))?.[1] ?? [];
      if (campuri.length > 0) {
        throw invalidInput(mesaj, Object.fromEntries(campuri.map((c) => [c, [mesaj]])));
      }
      throw businessRule(mesaj);
    }
  }
  traduEroare(error);
}

/**
 * Legarea foii de o deplasare (`internal.foi_deplasare_garda`, 0204): orice
 * refuz al gărzii ține de selectorul de deplasare.
 */
export function traduEroareDeplasare(error: unknown): never {
  if (
    isPostgrestError(error) &&
    error.code === "P0001" &&
    /^Deplasarea aleasă/u.test(error.message)
  ) {
    const mesaj = error.message.slice(0, 300);
    throw invalidInput(mesaj, { business_trip_id: [mesaj] });
  }
  traduEroare(error);
}
// ── SFÂRȘIT BLOC: permisele șoferilor ──

// ── ÎNCEPUT BLOC: fiscalul flotei (0205, F10) ──

/**
 * Restricțiile tabelelor fiscale (0205), pe câmpul lor. Schema le prinde
 * înaintea bazei; ajung aici doar dacă limitele diverg sau la o cursă.
 */
const RESTRICTII_FISCAL: readonly (readonly [string, string, string])[] = [
  [
    "vfr_vehicul_de_la_uq",
    "valabil_de_la",
    "Vehiculul are deja un regim fiscal care începe în ziua aceasta. Ștergeți-l întâi sau alegeți altă zi.",
  ],
  [
    "vcn_vehicul_de_la_uq",
    "valabil_de_la",
    "Vehiculul are deja o normă de consum care începe în ziua aceasta. Ștergeți-o întâi sau alegeți altă zi.",
  ],
  [
    "vfr_proprietar_fk",
    "proprietar_employee_id",
    "Angajatul ales nu aparține organizației dumneavoastră.",
  ],
  [
    "vfr_exceptie_ck",
    "exceptie",
    "Categoria exceptată se alege doar, și obligatoriu, la regimul „categorie exceptată”.",
  ],
  [
    "vfr_proprietar_ck",
    "proprietar_employee_id",
    "Proprietarul se alege doar, și obligatoriu, la mașina personală.",
  ],
  [
    "vfr_chirie_ck",
    "chirie_lunara",
    "Chiria se completează doar la vehiculul închiriat sau cu chirie.",
  ],
  ["vfr_motiv_ck", "motiv", "Motivul are între 3 și 1.000 de caractere."],
  ["vcn_l_100km_ck", "l_100km", "Norma e între 0,01 și 300 de litri la 100 km."],
];

/** Mesajele P0001 ale lui `internal.flota_fiscal_inainte` (ș/ț corecte). */
const CAMPURI_FISCAL: readonly (readonly [RegExp, readonly string[]])[] = [
  [/^Regimul „peste 3\.500 kg/u, ["regim"]],
  [/^Data de la care se aplică/u, ["valabil_de_la"]],
  [/^Data deciziei interne/u, ["decizie_data"]],
];

export function traduEroareFiscal(error: unknown): never {
  if (isPostgrestError(error)) {
    if (error.code === "23505" || error.code === "23503" || error.code === "23514") {
      const restrictie = RESTRICTII_FISCAL.find(([nume]) => error.message.includes(nume));
      if (restrictie !== undefined) {
        const [, camp, mesaj] = restrictie;
        throw invalidInput(mesaj, { [camp]: [mesaj] });
      }
    }
    if (error.code === "P0001") {
      const mesaj = error.message.slice(0, 300);
      const campuri = CAMPURI_FISCAL.find(([re]) => re.test(mesaj))?.[1] ?? [];
      if (campuri.length > 0) {
        throw invalidInput(mesaj, Object.fromEntries(campuri.map((c) => [c, [mesaj]])));
      }
      throw businessRule(mesaj);
    }
  }
  traduEroare(error);
}
// ── SFÂRȘIT BLOC: fiscalul flotei ──

// ── ÎNCEPUT BLOC: amenzi și daune (0206, F11) ──

/**
 * Restricțiile tabelelor `vehicle_fines` / `vehicle_incidents` (0206), pe
 * câmpul lor. Schema le prinde înaintea bazei; ajung aici doar dacă limitele
 * diverg sau la o cursă.
 */
const RESTRICTII_AMENZI: readonly (readonly [string, string, string])[] = [
  [
    "vf_numar_uq",
    "numar_pv",
    "Amenda cu acest număr este deja înregistrată pe vehiculul ales. Deschideți-o din listă.",
  ],
  ["vf_sofer_fk", "employee_id", "Angajatul ales nu aparține organizației dumneavoastră."],
  ["vi_sofer_fk", "sofer_id", "Angajatul ales nu aparține organizației dumneavoastră."],
  ["vf_numar_ck", "numar_pv", "Numărul procesului-verbal are între 1 și 60 de caractere."],
  ["vf_fapta_ck", "fapta", "Fapta constatată are între 3 și 500 de caractere."],
  ["vf_suma_ck", "suma", "Suma e între 0 și 1.000.000 lei."],
  ["vf_motiv_ck", "motiv", "Motivul are cel mult 500 de caractere."],
  ["vf_anulata_ck", "motiv", "Scrieți motivul anulării."],
  ["vi_descriere_ck", "descriere", "Descrierea are între 3 și 2.000 de caractere."],
  [
    "vi_asigurator_stadiu_ck",
    "asigurator",
    "Scrieți numele asigurătorului la care ați înregistrat dauna.",
  ],
];

/** Mesajele P0001 ale `internal.amenzi_inainte` și `internal.incidente_inainte` (ș/ț corecte). */
const CAMPURI_AMENZI: readonly (readonly [RegExp, readonly string[]])[] = [
  [/^Scrieți numărul procesului-verbal/u, ["numar_pv"]],
  [/^Scrieți fapta constatată/u, ["fapta"]],
  [/^Vehiculul ales/u, ["vehicle_id"]],
  [/^Momentul faptei/u, ["constatata_la"]],
  [/^Procesul-verbal nu poate fi încheiat/u, ["data_pv"]],
  [/^Data primirii/u, ["primita_la"]],
  [/^Termenul de răspuns/u, ["termen_raspuns"]],
  [/^Alegeți șoferul pe care/u, ["employee_id"]],
  [/^Scrieți data la care a plecat răspunsul/u, ["raspuns_trimis_la"]],
  [/^Data trimiterii răspunsului/u, ["raspuns_trimis_la"]],
  [/^Scrieți motivul anulării/u, ["motiv"]],
  [/^Descrieți incidentul/u, ["descriere"]],
  [/^Momentul incidentului/u, ["produs_la"]],
  [/^Cercetarea SSM aleasă/u, ["work_accident_id"]],
  [/^Scrieți numele asigurătorului/u, ["asigurator"]],
  [/^Scrieți costul final/u, ["cost_final"]],
];

export function traduEroareAmenzi(error: unknown): never {
  if (isPostgrestError(error)) {
    if (error.code === "23505" || error.code === "23503" || error.code === "23514") {
      const restrictie = RESTRICTII_AMENZI.find(([nume]) => error.message.includes(nume));
      if (restrictie !== undefined) {
        const [, camp, mesaj] = restrictie;
        throw invalidInput(mesaj, { [camp]: [mesaj] });
      }
    }
    if (error.code === "P0001") {
      const mesaj = error.message.slice(0, 300);
      const campuri = CAMPURI_AMENZI.find(([re]) => re.test(mesaj))?.[1] ?? [];
      if (campuri.length > 0) {
        throw invalidInput(mesaj, Object.fromEntries(campuri.map((c) => [c, [mesaj]])));
      }
      // Refuzurile de stadiu („nu poate trece din…”, „este închisă…”) nu țin de
      // un câmp: rămân mesaj general, cu cifrele din bază.
      throw businessRule(mesaj);
    }
  }
  traduEroare(error);
}
// ── SFÂRȘIT BLOC: amenzi și daune ──
