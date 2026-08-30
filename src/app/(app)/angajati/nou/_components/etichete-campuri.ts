// src/app/(app)/angajati/nou/_components/etichete-campuri.ts
import type { InroleazaAngajatInput } from "@/schemas/employee";

/**
 * Numele omenesc al fiecărui câmp din asistentul de înrolare.
 *
 * ── DE CE UN DICȚIONAR ȘI NU ETICHETA DIN JSX ─────────────────────────────
 * Rezumatul de erori stă lângă butoane și trebuie să numească un câmp care, de
 * cele mai multe ori, e pe alt pas — deci NEMONTAT. Eticheta lui nu există în
 * arbore în clipa în care rezumatul se randează, așa că nu poate fi citită de
 * acolo.
 *
 * ── DE CE `Record<keyof …, string>` ───────────────────────────────────────
 * Tipul cere TOATE cheile. Un câmp adăugat în schemă fără etichetă aici **nu
 * compilează** — nu apare tăcut în rezumat cu numele lui tehnic, așa cum ar
 * face o hartă parțială cu `?? camp`. Aceeași disciplină ca la
 * `src/components/ui/camp.tsx`: imposibilitatea uitării, nu economia de cod.
 *
 * Textele repetă etichetele de pe ecran, cuvânt cu cuvânt. Cine citește
 * „Regim special” în rezumat trebuie să găsească exact „Regim special” pe pas.
 */
export const ETICHETE_CAMPURI: Readonly<Record<keyof InroleazaAngajatInput, string>> = {
  // Pasul 1 — identitate
  last_name: "Nume",
  first_name: "Prenume",
  data_nasterii: "Data nașterii",
  gen: "Gen",
  cetatenie: "Cetățenie",
  stare_civila: "Stare civilă",
  tip_act_identitate: "Tipul actului de identitate",
  reges_tip_act: "Tipul actului de identitate",
  serie_act: "Seria actului de identitate",
  numar_act: "Numărul actului de identitate",
  act_eliberat_de: "Actul eliberat de",
  act_eliberat_la: "Data eliberării actului",
  act_valabil_pana: "Actul valabil până la",
  cnp: "CNP",
  grad_handicap: "Grad de handicap",
  nr_persoane_intretinere: "Persoane în întreținere",
  optiune_pilon_ii: "Opțiunea pentru Pilonul II",
  permis_tip: "Tipul permisului de muncă",
  permis_numar: "Numărul permisului de muncă",
  permis_emis_de: "Permisul emis de",
  permis_valabil_de_la: "Permisul valabil de la",
  permis_valabil_pana: "Permisul valabil până la",
  numar_pasaport: "Numărul pașaportului",

  // Pasul 2 — contact și adrese
  email_personal: "E-mail personal",
  telefon: "Telefon",
  adresa_strada: "Domiciliu — strada",
  adresa_oras: "Domiciliu — localitatea",
  adresa_judet: "Domiciliu — județul",
  adresa_cod_postal: "Domiciliu — codul poștal",
  adresa_resedinta_strada: "Reședința — strada",
  adresa_resedinta_oras: "Reședința — localitatea",
  adresa_resedinta_judet: "Reședința — județul",
  adresa_resedinta_cod_postal: "Reședința — codul poștal",
  email_serviciu: "E-mail de serviciu",
  telefon_serviciu: "Telefon de serviciu",
  contact_urgenta_nume: "Contact de urgență — numele",
  contact_urgenta_telefon: "Contact de urgență — telefonul",
  contact_urgenta_relatie: "Contact de urgență — relația",

  // Pasul 3 — angajare și contract
  department_id: "Departament",
  functie: "Funcție",
  cod_cor: "Cod COR",
  manager_employee_id: "Manager direct",
  hired_on: "Data angajării (fișă)",
  conditii_munca: "Condiții de muncă",
  numar: "Număr contract",
  data_contract: "Data contractului",
  valabil_de_la: "Angajat de la (valabil de la)",
  valabil_pana: "Contractul valabil până la",
  contract_duration: "Durata contractului",
  motiv_determinat: "Motivul duratei determinate",
  norma_ore_saptamana: "Normă (ore/săptămână)",
  norma_ore_zi: "Normă (ore/zi)",
  work_mode: "Mod de lucru",
  special_regime: "Regim special",
  loc_telemunca: "Locul desfășurării activității",
  loc_munca: "Locul de muncă",
  punct_lucru_id: "Locul de muncă",
  salariu_baza: "Salariu de bază brut (lunar)",
  moneda: "Monedă",
  zile_concediu_anual: "Zile de concediu de odihnă anual",
  perioada_proba_zile: "Perioadă de probă (zile)",
  preaviz_zile: "Preaviz (zile)",
  iban: "IBAN",
  banca: "Bancă",

  // Pasul 4 — fișa postului
  subordonare: "Subordonare",
  atributii: "Atribuții",
  competente: "Competențe necesare",

  // Pasul 5 — bunuri și certificări
  inventory_item_ids: "Bunuri predate la înrolare",
  examen_data: "Data examenului medical",
  examen_tip: "Tipul examenului medical",
  examen_rezultat: "Rezultatul examenului medical",
  examen_valabil_pana: "Fișa de aptitudine valabilă până la",
  examen_medic: "Medicul",
  examen_unitate_medicala: "Unitatea medicală",
  examen_numar_fisa: "Numărul fișei de aptitudine",
  autorizatii: "Autorizații",

  // Fără control în asistent — au implicit, dar pot primi o eroare de server.
  is_primary: "Fișă principală",
  observatii: "Observații",
};

/**
 * Eticheta pentru o cale de eroare, inclusiv una imbricată.
 *
 * react-hook-form dă căi de forma `autorizatii.2.numar` pentru listele de
 * câmpuri, iar `z.flattenError` din `create-action.ts` le COLAPSEAZĂ la prima
 * cheie (`autorizatii`). Amândouă formele trebuie să numească ceva citibil,
 * iar rândul din listă se numerotează de la 1 — omul vede „Autorizația 3”, nu
 * indicele 2.
 */
export function eticheteazaCamp(cale: string): string {
  const [radacina, ...rest] = cale.split(".");
  if (radacina === undefined || !(radacina in ETICHETE_CAMPURI)) return cale;

  const eticheta = ETICHETE_CAMPURI[radacina as keyof InroleazaAngajatInput];
  const indice = rest[0];
  if (indice === undefined || !/^\d+$/u.test(indice)) return eticheta;

  // Singular din plural, pentru listele asistentului.
  const singular = radacina === "autorizatii" ? "Autorizația" : eticheta;
  return `${singular} ${String(Number(indice) + 1)}`;
}
