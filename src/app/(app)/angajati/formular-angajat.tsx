// src/app/(app)/angajati/formular-angajat.tsx
"use client";

import { useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";

import { Buton, buton } from "@/components/ui/buton";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { CautaCor } from "@/components/cauta-cor";
import { Formular, type StareFormular } from "@/components/ui/formular";
import { IntrareData } from "@/components/ui/intrare-data";
import {
  CAMPURI_EDITABILE_ANGAJAT,
  CONDITII_MUNCA,
  GENURI,
  STARI_CIVILE,
} from "@/schemas/employee";

import { TIPURI_ACT_IDENTITATE } from "@/domain/reges/operatii";

import {
  ETICHETE_ACT_IDENTITATE,
  ETICHETE_CONDITII_MUNCA,
  ETICHETE_GEN,
  ETICHETE_STARE_CIVILA,
} from "./etichete";
import { actualizeazaAngajat } from "./actions";

interface Optiune {
  readonly id: string;
  readonly denumire: string;
}

interface Coleg {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
}

/**
 * Fișa așa cum o citește ecranul de editare — aceleași coloane pe care
 * `actualizeazaAngajatSchema` le acceptă la scriere.
 */
export interface AngajatDeEditat {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
  readonly last_name: string;
  readonly first_name: string;
  readonly email_personal: string | null;
  readonly telefon: string | null;
  readonly email_serviciu: string | null;
  readonly telefon_serviciu: string | null;
  readonly adresa_strada: string | null;
  readonly adresa_oras: string | null;
  readonly adresa_judet: string | null;
  readonly adresa_cod_postal: string | null;
  readonly adresa_resedinta_strada: string | null;
  readonly adresa_resedinta_oras: string | null;
  readonly adresa_resedinta_judet: string | null;
  readonly adresa_resedinta_cod_postal: string | null;
  readonly stare_civila: string | null;
  readonly data_nasterii: string | null;
  readonly gen: string;
  readonly cetatenie: string;
  readonly tip_act_identitate: string | null;
  readonly reges_tip_act: string | null;
  readonly serie_act: string | null;
  readonly numar_act: string | null;
  readonly act_eliberat_de: string | null;
  readonly act_eliberat_la: string | null;
  readonly act_valabil_pana: string | null;
  readonly department_id: string | null;
  readonly functie: string | null;
  readonly cod_cor: string | null;
  readonly manager_employee_id: string | null;
  readonly hired_on: string | null;
  readonly conditii_munca: string;
  readonly grad_handicap: string | null;
  readonly optiune_pilon_ii: boolean;
  readonly contact_urgenta_nume: string | null;
  readonly contact_urgenta_telefon: string | null;
  readonly contact_urgenta_relatie: string | null;
  readonly observatii: string | null;
}

interface Proprietati {
  readonly departamente: readonly Optiune[];
  readonly colegi: readonly Coleg[];
  readonly angajat: AngajatDeEditat;
}

/**
 * Cele două chei care NU se pot lua ca text din `FormData`. Restul se parcurg
 * din `CAMPURI_EDITABILE_ANGAJAT`, lista pe care schema și testul din
 * `src/schemas/employee.test.ts` o țin sincronizată cu `.pick()`.
 */
const CAMPURI_NETEXT = new Set<string>(["stare_civila", "optiune_pilon_ii"]);

/**
 * Payload-ul trimis acțiunii — TOATE cheile pe care schema le acceptă.
 *
 * ── DE CE SE TRIMIT TOATE, NU DOAR CELE MODIFICATE ────────────────────────
 * `actualizeazaAngajatSchema` face `.pick()` din `creeazaAngajatSchema`, iar
 * câmpurile picate își păstrează `.default(...)`. O cheie ABSENTĂ din obiect nu
 * înseamnă „nu schimba" — înseamnă „aplică implicitul", iar handler-ul trimite
 * mai departe tot ce a ieșit din Zod. Măsurat pe codul de dinainte: formularul
 * trimitea 12 chei, `.update()` primea 34, iar celelalte 22 se scriau ca `null`
 * (sau reveneau la „RO", „normale", `true`) la FIECARE salvare. Corectarea unui
 * număr de telefon ștergea adresa, actul de identitate, contactul de urgență,
 * starea civilă și managerul direct — fără nicio eroare, fiindcă `UPDATE`-ul
 * reușea perfect.
 *
 * Consecința pentru cine adaugă un câmp în `.pick()`: aici ajunge automat, dar
 * ca șir gol. Trebuie să primească și un control randat mai jos, altfel prima
 * salvare îl golește. Testul din `employee.test.ts` prinde jumătatea de sus a
 * regulii; jumătatea de jos rămâne în sarcina cititorului.
 */
function construiestePayload(id: string, date: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = { id };
  for (const cheie of CAMPURI_EDITABILE_ANGAJAT) {
    if (CAMPURI_NETEXT.has(cheie)) continue;
    payload[cheie] = String(date.get(cheie) ?? "");
  }
  // `stare_civila` e `z.enum(...).nullable()`: șirul gol NU e o valoare validă
  // a enum-ului, iar „neales" trebuie să ajungă ca `null`, nu ca `""`.
  const stareCivila = String(date.get("stare_civila") ?? "");
  payload["stare_civila"] = stareCivila === "" ? null : stareCivila;
  // O bifă nebifată lipsește cu totul din `FormData`. Se trimite boolean, nu
  // șir: `z.coerce.boolean()` transformă ORICE șir nevid în `true`, deci un
  // „false" textual ar fi bifat pilonul II al cuiva care tocmai l-a debifat.
  payload["optiune_pilon_ii"] = date.get("optiune_pilon_ii") !== null;
  return payload;
}

function Sectiune({
  titlu,
  descriere,
  children,
  clasaGrila = "sm:grid-cols-2 lg:grid-cols-3",
}: {
  readonly titlu: string;
  readonly descriere?: string;
  readonly children: ReactNode;
  readonly clasaGrila?: string;
}) {
  return (
    <fieldset className="border-border bg-background rounded-panou shadow-ridicat border p-5">
      <legend className="text-corp px-1 font-semibold">{titlu}</legend>
      {descriere === undefined ? null : (
        <p className="text-muted-foreground text-nota mt-1">{descriere}</p>
      )}
      <div className={`mt-3 grid grid-cols-1 gap-4 ${clasaGrila}`}>{children}</div>
    </fieldset>
  );
}

/** `valoriTrimise` are prioritate: după o eroare de validare, ecranul arată ce a scris omul. */
function valoare(
  stare: StareFormular<{ id: string }>,
  cheie: string,
  initial: string | null,
): string {
  return stare.valoriTrimise[cheie] ?? initial ?? "";
}

/**
 * Aceeași regulă pentru o BIFĂ — care nu se poate citi la fel.
 *
 * O bifă nebifată lipsește CU TOTUL din `FormData`, deci `valoriTrimise` nu are
 * cheia ei nici înainte de prima trimitere, nici după una în care omul tocmai a
 * debifat-o. Citită ca `valoriTrimise[cheie] === "on"`, cele două cazuri se
 * confundă și se cade pe valoarea din bază: cine debifa pilonul II și greșea
 * ALT câmp primea formularul înapoi cu bifa pusă la loc (React 19 resetează
 * câmpurile necontrolate după acțiune), iar a doua trimitere scria din nou
 * `true`. O opțiune de pensie se întorcea singură, fără niciun mesaj.
 *
 * `valoriTrimise` gol înseamnă „nu s-a trimis încă nimic”; nevid înseamnă că
 * ultima trimitere a purtat toate câmpurile text, deci absența cheii bifei e o
 * informație, nu o lipsă de informație.
 */
function bifa(stare: StareFormular<{ id: string }>, cheie: string, initial: boolean): boolean {
  if (Object.keys(stare.valoriTrimise).length === 0) return initial;
  return stare.valoriTrimise[cheie] === "on";
}

export function FormularAngajat({ departamente, colegi, angajat }: Proprietati) {
  const router = useRouter();

  const trimite = useCallback(
    async (date: FormData) => actualizeazaAngajat(construiestePayload(angajat.id, date)),
    [angajat.id],
  );

  // `useCallback`: `laReusita` intră în dependențele efectului de succes din
  // `Formular`. O funcție nouă la fiecare randare ar reporni efectul după
  // `router.refresh()`, iar notificarea ar apărea de două ori.
  const laReusita = useCallback(() => {
    router.push(`/angajati/${angajat.id}`);
    router.refresh();
  }, [router, angajat.id]);

  return (
    <Formular
      actiune={trimite}
      laReusita={laReusita}
      mesajReusita="Fișa a fost actualizată."
      className="gap-6"
    >
      {(stare) => (
        <>
          <Sectiune titlu="Identitate">
            <Camp
              nume="last_name"
              eticheta="Nume"
              obligatoriu
              erori={stare.erori["last_name"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  autoComplete="family-name"
                  maxLength={80}
                  defaultValue={valoare(stare, "last_name", angajat.last_name)}
                />
              )}
            </Camp>
            <Camp
              nume="first_name"
              eticheta="Prenume"
              obligatoriu
              erori={stare.erori["first_name"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  autoComplete="given-name"
                  maxLength={80}
                  defaultValue={valoare(stare, "first_name", angajat.first_name)}
                />
              )}
            </Camp>
            <Camp nume="gen" eticheta="Gen" fel="select" erori={stare.erori["gen"] ?? []}>
              {(a) => (
                <select {...a} defaultValue={valoare(stare, "gen", angajat.gen)}>
                  {GENURI.map((cod) => (
                    <option key={cod} value={cod}>
                      {ETICHETE_GEN[cod]}
                    </option>
                  ))}
                </select>
              )}
            </Camp>
            <Camp
              nume="data_nasterii"
              eticheta="Data nașterii"
              erori={stare.erori["data_nasterii"] ?? []}
            >
              {(a) => (
                <IntrareData
                  {...a}
                  implicit={valoare(stare, "data_nasterii", angajat.data_nasterii)}
                />
              )}
            </Camp>
            <Camp
              nume="cetatenie"
              eticheta="Cetățenie"
              obligatoriu
              ajutor="Codul de țară din două litere, ex. RO."
              erori={stare.erori["cetatenie"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={2}
                  className={`${a.className} uppercase`}
                  defaultValue={valoare(stare, "cetatenie", angajat.cetatenie)}
                />
              )}
            </Camp>
            <Camp
              nume="stare_civila"
              eticheta="Stare civilă"
              fel="select"
              erori={stare.erori["stare_civila"] ?? []}
            >
              {(a) => (
                <select {...a} defaultValue={valoare(stare, "stare_civila", angajat.stare_civila)}>
                  <option value="">Nedeclarată</option>
                  {STARI_CIVILE.map((cod) => (
                    <option key={cod} value={cod}>
                      {ETICHETE_STARE_CIVILA[cod]}
                    </option>
                  ))}
                </select>
              )}
            </Camp>
          </Sectiune>

          <Sectiune titlu="Contact">
            <Camp
              nume="email_personal"
              eticheta="E-mail personal"
              erori={stare.erori["email_personal"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="email"
                  autoComplete="email"
                  defaultValue={valoare(stare, "email_personal", angajat.email_personal)}
                />
              )}
            </Camp>
            <Camp nume="telefon" eticheta="Telefon" erori={stare.erori["telefon"] ?? []}>
              {(a) => (
                <input
                  {...a}
                  type="tel"
                  autoComplete="tel"
                  maxLength={32}
                  defaultValue={valoare(stare, "telefon", angajat.telefon)}
                />
              )}
            </Camp>
            <Camp
              nume="email_serviciu"
              eticheta="E-mail de serviciu"
              erori={stare.erori["email_serviciu"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="email"
                  autoComplete="off"
                  defaultValue={valoare(stare, "email_serviciu", angajat.email_serviciu)}
                />
              )}
            </Camp>
            <Camp
              nume="telefon_serviciu"
              eticheta="Telefon de serviciu"
              erori={stare.erori["telefon_serviciu"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="tel"
                  autoComplete="off"
                  maxLength={32}
                  defaultValue={valoare(stare, "telefon_serviciu", angajat.telefon_serviciu)}
                />
              )}
            </Camp>
          </Sectiune>

          <Sectiune titlu="Domiciliu">
            <Camp
              nume="adresa_strada"
              eticheta="Stradă și număr"
              className="lg:col-span-2"
              erori={stare.erori["adresa_strada"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={200}
                  defaultValue={valoare(stare, "adresa_strada", angajat.adresa_strada)}
                />
              )}
            </Camp>
            <Camp nume="adresa_oras" eticheta="Localitate" erori={stare.erori["adresa_oras"] ?? []}>
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={120}
                  defaultValue={valoare(stare, "adresa_oras", angajat.adresa_oras)}
                />
              )}
            </Camp>
            <Camp nume="adresa_judet" eticheta="Județ" erori={stare.erori["adresa_judet"] ?? []}>
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={80}
                  defaultValue={valoare(stare, "adresa_judet", angajat.adresa_judet)}
                />
              )}
            </Camp>
            <Camp
              nume="adresa_cod_postal"
              eticheta="Cod poștal"
              erori={stare.erori["adresa_cod_postal"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={12}
                  defaultValue={valoare(stare, "adresa_cod_postal", angajat.adresa_cod_postal)}
                />
              )}
            </Camp>
          </Sectiune>

          <Sectiune
            titlu="Reședință"
            descriere="Se completează doar dacă diferă de domiciliul de mai sus."
          >
            <Camp
              nume="adresa_resedinta_strada"
              eticheta="Stradă și număr"
              className="lg:col-span-2"
              erori={stare.erori["adresa_resedinta_strada"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={200}
                  defaultValue={valoare(
                    stare,
                    "adresa_resedinta_strada",
                    angajat.adresa_resedinta_strada,
                  )}
                />
              )}
            </Camp>
            <Camp
              nume="adresa_resedinta_oras"
              eticheta="Localitate"
              erori={stare.erori["adresa_resedinta_oras"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={120}
                  defaultValue={valoare(
                    stare,
                    "adresa_resedinta_oras",
                    angajat.adresa_resedinta_oras,
                  )}
                />
              )}
            </Camp>
            <Camp
              nume="adresa_resedinta_judet"
              eticheta="Județ"
              erori={stare.erori["adresa_resedinta_judet"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={80}
                  defaultValue={valoare(
                    stare,
                    "adresa_resedinta_judet",
                    angajat.adresa_resedinta_judet,
                  )}
                />
              )}
            </Camp>
            <Camp
              nume="adresa_resedinta_cod_postal"
              eticheta="Cod poștal"
              erori={stare.erori["adresa_resedinta_cod_postal"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={12}
                  defaultValue={valoare(
                    stare,
                    "adresa_resedinta_cod_postal",
                    angajat.adresa_resedinta_cod_postal,
                  )}
                />
              )}
            </Camp>
          </Sectiune>

          <Sectiune titlu="Act de identitate">
            <Camp
              nume="tip_act_identitate"
              eticheta="Tipul actului"
              ajutor="Ex. CI, pașaport, permis de ședere."
              erori={stare.erori["tip_act_identitate"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={40}
                  defaultValue={valoare(stare, "tip_act_identitate", angajat.tip_act_identitate)}
                />
              )}
            </Camp>
            {/*
              Forma STRUCTURATĂ a aceluiași act, în vocabularul REGES. Cele două
              coloane coexistă: `tip_act_identitate` e textul tipărit pe
              documente, `reges_tip_act` e ce se transmite la ITM. Asistentul de
              înrolare scrie amândouă dintr-un singur `<select>`; aici rămân
              separate, fiindcă fișele vechi au deja text liber propriu.
            */}
            <Camp
              nume="reges_tip_act"
              eticheta="Tipul actului (REGES)"
              fel="select"
              ajutor="Se transmite la ITM. Fără el, transmiterea cade pe „carte de identitate” pentru toată lumea."
              erori={stare.erori["reges_tip_act"] ?? []}
            >
              {(a) => (
                <select
                  {...a}
                  defaultValue={valoare(stare, "reges_tip_act", angajat.reges_tip_act)}
                >
                  <option value="">— Nespecificat —</option>
                  {TIPURI_ACT_IDENTITATE.map((tip) => (
                    <option key={tip} value={tip}>
                      {ETICHETE_ACT_IDENTITATE[tip]}
                    </option>
                  ))}
                </select>
              )}
            </Camp>
            <Camp
              nume="act_eliberat_la"
              eticheta="Data eliberării"
              ajutor="Cerută literal de textul contractului de muncă."
              erori={stare.erori["act_eliberat_la"] ?? []}
            >
              {(a) => (
                <IntrareData
                  {...a}
                  implicit={valoare(stare, "act_eliberat_la", angajat.act_eliberat_la)}
                />
              )}
            </Camp>
            <Camp nume="serie_act" eticheta="Serie" erori={stare.erori["serie_act"] ?? []}>
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={10}
                  defaultValue={valoare(stare, "serie_act", angajat.serie_act)}
                />
              )}
            </Camp>
            <Camp nume="numar_act" eticheta="Număr" erori={stare.erori["numar_act"] ?? []}>
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={20}
                  defaultValue={valoare(stare, "numar_act", angajat.numar_act)}
                />
              )}
            </Camp>
            <Camp
              nume="act_eliberat_de"
              eticheta="Eliberat de"
              className="lg:col-span-2"
              erori={stare.erori["act_eliberat_de"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={120}
                  defaultValue={valoare(stare, "act_eliberat_de", angajat.act_eliberat_de)}
                />
              )}
            </Camp>
            <Camp
              nume="act_valabil_pana"
              eticheta="Valabil până la"
              erori={stare.erori["act_valabil_pana"] ?? []}
            >
              {(a) => (
                <IntrareData
                  {...a}
                  implicit={valoare(stare, "act_valabil_pana", angajat.act_valabil_pana)}
                />
              )}
            </Camp>
          </Sectiune>

          <Sectiune titlu="Angajare">
            <Camp nume="hired_on" eticheta="Data angajării" erori={stare.erori["hired_on"] ?? []}>
              {(a) => (
                <IntrareData {...a} implicit={valoare(stare, "hired_on", angajat.hired_on)} />
              )}
            </Camp>
            <Camp
              nume="department_id"
              eticheta="Departament"
              fel="select"
              erori={stare.erori["department_id"] ?? []}
            >
              {(a) => (
                <select
                  {...a}
                  defaultValue={valoare(stare, "department_id", angajat.department_id)}
                >
                  <option value="">Nealocat</option>
                  {departamente.map((optiune) => (
                    <option key={optiune.id} value={optiune.id}>
                      {optiune.denumire}
                    </option>
                  ))}
                </select>
              )}
            </Camp>
            <Camp nume="functie" eticheta="Funcție" erori={stare.erori["functie"] ?? []}>
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={160}
                  defaultValue={valoare(stare, "functie", angajat.functie)}
                  placeholder="Sudor, Operator producție, Director general…"
                />
              )}
            </Camp>
            {/*
              Codul COR e ce ajunge în REVISAL; `domain/reges/export.ts` refuză
              contractul fără el. `CautaCor` randează chiar un `<input
              name="cod_cor">`, deci formularul îl citește din `FormData` fără
              să știe nimic despre componentă.
            */}
            <Camp
              nume="cod_cor"
              eticheta="Cod COR"
              erori={stare.erori["cod_cor"] ?? []}
              ajutor="Șase cifre din Clasificarea Ocupațiilor din România."
            >
              {(a) => (
                <CautaCor
                  idInput={a.id}
                  valoareInitiala={valoare(stare, "cod_cor", angajat.cod_cor)}
                  invalid={(stare.erori["cod_cor"] ?? []).length > 0}
                  descrisDe={a["aria-describedby"]}
                />
              )}
            </Camp>
            <Camp
              nume="manager_employee_id"
              eticheta="Manager direct"
              fel="select"
              ajutor="Determină organigrama și cine îi aprobă cererile."
              erori={stare.erori["manager_employee_id"] ?? []}
            >
              {(a) => (
                <select
                  {...a}
                  defaultValue={valoare(stare, "manager_employee_id", angajat.manager_employee_id)}
                >
                  <option value="">Fără manager</option>
                  {colegi.map((coleg) => (
                    <option key={coleg.id} value={coleg.id}>
                      {coleg.full_name} ({coleg.marca})
                    </option>
                  ))}
                </select>
              )}
            </Camp>
            <Camp
              nume="conditii_munca"
              eticheta="Condiții de muncă"
              fel="select"
              erori={stare.erori["conditii_munca"] ?? []}
            >
              {(a) => (
                <select
                  {...a}
                  defaultValue={valoare(stare, "conditii_munca", angajat.conditii_munca)}
                >
                  {CONDITII_MUNCA.map((cod) => (
                    <option key={cod} value={cod}>
                      {ETICHETE_CONDITII_MUNCA[cod]}
                    </option>
                  ))}
                </select>
              )}
            </Camp>
            <Camp
              nume="grad_handicap"
              eticheta="Grad de handicap"
              ajutor="Se completează doar dacă există certificat."
              erori={stare.erori["grad_handicap"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={20}
                  defaultValue={valoare(stare, "grad_handicap", angajat.grad_handicap)}
                />
              )}
            </Camp>
            <div className="flex items-start gap-2 lg:col-span-3">
              <input
                id="camp-optiune_pilon_ii"
                name="optiune_pilon_ii"
                type="checkbox"
                className={`${clasaBifa} mt-0.5`}
                defaultChecked={bifa(stare, "optiune_pilon_ii", angajat.optiune_pilon_ii)}
              />
              <label htmlFor="camp-optiune_pilon_ii" className="text-corp">
                Contribuie la pilonul II de pensii
              </label>
            </div>
          </Sectiune>

          <Sectiune titlu="Contact de urgență">
            <Camp
              nume="contact_urgenta_nume"
              eticheta="Nume"
              erori={stare.erori["contact_urgenta_nume"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={120}
                  defaultValue={valoare(
                    stare,
                    "contact_urgenta_nume",
                    angajat.contact_urgenta_nume,
                  )}
                />
              )}
            </Camp>
            <Camp
              nume="contact_urgenta_telefon"
              eticheta="Telefon"
              erori={stare.erori["contact_urgenta_telefon"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="tel"
                  maxLength={32}
                  defaultValue={valoare(
                    stare,
                    "contact_urgenta_telefon",
                    angajat.contact_urgenta_telefon,
                  )}
                />
              )}
            </Camp>
            <Camp
              nume="contact_urgenta_relatie"
              eticheta="Relație"
              ajutor="Ex. soț/soție, părinte, frate."
              erori={stare.erori["contact_urgenta_relatie"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={60}
                  defaultValue={valoare(
                    stare,
                    "contact_urgenta_relatie",
                    angajat.contact_urgenta_relatie,
                  )}
                />
              )}
            </Camp>
          </Sectiune>

          <Sectiune titlu="Observații" clasaGrila="">
            <Camp
              nume="observatii"
              eticheta="Note interne"
              fel="textarea"
              erori={stare.erori["observatii"] ?? []}
            >
              {(a) => (
                <textarea
                  {...a}
                  rows={4}
                  maxLength={2000}
                  defaultValue={valoare(stare, "observatii", angajat.observatii)}
                />
              )}
            </Camp>
          </Sectiune>

          {/*
           * Bara laterală e `border-l-primary`, nu auriul de accent: auriul pe
           * fundalul paginii dă 2,26:1, deci nu poate purta singur un sens.
           * Cuvântul „Date sensibile" și textul de sub el îl poartă.
           */}
          <fieldset className="border-border border-l-primary bg-surface rounded-panou shadow-ridicat border border-l-2 p-5">
            <legend className="text-corp flex items-center gap-1.5 px-1 font-semibold">
              <Lock aria-hidden="true" className="text-foreground size-4" />
              Date sensibile
            </legend>
            <p className="text-muted-foreground text-nota mt-1">
              Se păstrează criptate și nu se pot citi din acest ecran. Lăsați câmpurile goale dacă
              valorile nu se schimbă.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Camp
                nume="cnp"
                eticheta="CNP"
                ajutor="Gol = valoarea actuală rămâne neschimbată."
                erori={stare.erori["cnp"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="text"
                    inputMode="numeric"
                    maxLength={13}
                    autoComplete="off"
                    defaultValue={stare.valoriTrimise["cnp"] ?? ""}
                  />
                )}
              </Camp>
              <Camp
                nume="iban"
                eticheta="IBAN"
                ajutor="Gol = valoarea actuală rămâne neschimbată."
                erori={stare.erori["iban"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="text"
                    maxLength={34}
                    autoComplete="off"
                    defaultValue={stare.valoriTrimise["iban"] ?? ""}
                  />
                )}
              </Camp>
              <Camp nume="banca" eticheta="Bancă" erori={stare.erori["banca"] ?? []}>
                {(a) => (
                  <input
                    {...a}
                    type="text"
                    maxLength={80}
                    autoComplete="off"
                    defaultValue={stare.valoriTrimise["banca"] ?? ""}
                  />
                )}
              </Camp>
            </div>
          </fieldset>

          <div className="border-border flex flex-wrap justify-end gap-3 border-t pt-4">
            <Link href={`/angajati/${angajat.id}`} className={buton({ varianta: "secundar" })}>
              Renunță
            </Link>
            <Buton type="submit" varianta="primar" inCurs={stare.inCurs} textInCurs="Se salvează…">
              Salvează fișa
            </Buton>
          </div>
        </>
      )}
    </Formular>
  );
}
