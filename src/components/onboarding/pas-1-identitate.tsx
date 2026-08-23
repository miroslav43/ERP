// src/components/onboarding/pas-1-identitate.tsx
"use client";

import { useWatch, type UseFormReturn } from "react-hook-form";

import {
  FORME_JURIDICE,
  JUDETE,
  SECTOARE_BUCURESTI,
  type OnboardeazaOrganizatieInput,
} from "@/schemas/organization";
import { maximSecundare } from "@/domain/organization/caen-reguli";
import {
  SelectorCodCaenPrincipal,
  SelectorCodCaenSecundare,
} from "@/components/forms/selector-cod-caen";
import { Camp, clasaBifa } from "@/components/ui/camp";

import { mesajeEroare } from "./campuri-comune";
import { CampCuiAnaf } from "./camp-cui-anaf";

/**
 * Pasul 1 al asistentului de înrolare — identitatea firmei.
 *
 * ── CE S-A REPARAT AICI, ȘI DE CE NU SE VEDEA ─────────────────────────────
 * Fiecare câmp avea eticheta, controlul și mesajul de eroare scrise de mână, cu
 * identificatori compuși din `idFormular`. Mesajul de eroare avea `id`, dar
 * `aria-describedby` al controlului arăta — când exista — spre textul de
 * AJUTOR, niciodată spre eroare:
 *
 *     aria-describedby={`${idFormular}-legal-name-ajutor`}
 *     <Eroare id={`${idFormular}-legal-name-eroare`} … />   ← nereferit
 *
 * Consecința: pe cel mai lung formular din produs — șapte pași, primul lucru pe
 * care îl face un client nou — cine folosește un cititor de ecran auzea „câmp
 * nevalid" fără să afle NICIODATĂ ce anume e greșit. Câmpurile fără text de
 * ajutor (`name`, `slug`, `oras`, `email_contact`, `telefon_contact`, `judet`,
 * `capital_social`) n-aveau `aria-describedby` deloc, deci eroarea lor era pur
 * și simplu orfană în DOM.
 *
 * `<Camp>` compune `aria-describedby` din AMÂNDOUĂ, în ordinea „întâi ce e
 * greșit, apoi ce se aștepta", și pune `role="alert"` pe mesaj. Legătura nu mai
 * poate fi uitată la câmpul următor, fiindcă nu se mai scrie.
 *
 * ── DE CE RENDER-PROP, NU UN `<Camp>` CARE RANDEAZĂ SINGUR `<input>` ──────
 * Pasul ăsta are patru feluri de control: `<input>`, `<select>`, o bifă și doi
 * selectoare de cod CAEN care sunt componente proprii, cu API-ul lor
 * (`ariaInvalid`, `ariaDescribedBy`). Un `<Camp>` care ar randa el controlul ar
 * fi servit doar primele două. Aici primește atributele și le duce unde
 * trebuie — inclusiv într-un component care le numește altfel.
 *
 * `register()` se împrăștie DUPĂ atributele lui `Camp`: el aduce `ref`,
 * `onChange` și `onBlur`, iar `name` e același șir în ambele.
 */
export const CAMPURI_PAS_1 = [
  "name",
  "legal_name",
  "forma_juridica",
  "cui",
  "platitor_tva",
  "reg_com",
  "slug",
  "email_contact",
  "telefon_contact",
  "judet",
  "sector",
  "oras",
  "adresa",
  "cod_postal",
  "capital_social",
  "cod_caen",
  "cod_caen_secundare",
] as const satisfies readonly (keyof OnboardeazaOrganizatieInput)[];

interface Proprietati {
  readonly formular: UseFormReturn<OnboardeazaOrganizatieInput>;
  readonly idFormular: string;
}

export function Pas1Identitate({ formular, idFormular }: Proprietati) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = formular;
  // `useWatch`, NU `formular.watch(…)`. `watch` abonează doar componenta care
  // apelează `useForm` (asistentul), nu și pașii lui. În plus, cu React
  // Compiler activ (`reactCompiler: true`), `<Pas1Identitate formular={…}
  // idFormular={…} />` are props cu identitate stabilă, deci elementul e
  // memoizat și pasul nu se mai re-randează deloc după montare: selectorul de
  // cod CAEN primea la nesfârșit `value={undefined}` și caseta rămânea goală
  // deși valoarea era în formular. `useWatch` creează abonamentul aici, în
  // componenta care are nevoie de valoare.
  const judetSelectat = useWatch({ control, name: "judet" });
  const formaJuridicaSelectata = useWatch({ control, name: "forma_juridica" });
  const codCaenPrincipal = useWatch({ control, name: "cod_caen" });
  const codCaenSecundare = useWatch({ control, name: "cod_caen_secundare" }) ?? [];
  const limitaSecundare = maximSecundare(formaJuridicaSelectata);

  /** Identificatorii rămân prefixați: aceiași pași se randează în două zone. */
  const idc = (sufix: string): string => `${idFormular}-${sufix}`;

  return (
    <div className="space-y-6">
      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">Date de identificare</legend>

        <Camp
          nume="name"
          id={idc("name")}
          eticheta="Denumire"
          obligatoriu
          erori={mesajeEroare(errors.name?.message)}
        >
          {(a) => <input {...a} {...register("name")} />}
        </Camp>

        <Camp
          nume="legal_name"
          id={idc("legal-name")}
          eticheta="Denumire completă (statut)"
          obligatoriu
          ajutor="Forma juridică completă, exact ca în actul constitutiv — apare pe contracte, adeverințe și orice alt document oficial. Denumirea de mai sus rămâne cea afișată în aplicație."
          erori={mesajeEroare(errors.legal_name?.message)}
        >
          {(a) => <input {...a} {...register("legal_name")} placeholder="SC Compania Mea SRL" />}
        </Camp>

        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="forma_juridica"
            id={idc("forma")}
            eticheta="Formă de organizare"
            fel="select"
            obligatoriu
            erori={mesajeEroare(errors.forma_juridica?.message)}
          >
            {(a) => (
              <select {...a} {...register("forma_juridica")}>
                {FORME_JURIDICE.map((forma) => (
                  <option key={forma} value={forma}>
                    {forma}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          <CampCuiAnaf formular={formular} idFormular={idFormular} />
        </div>

        {/* Bifa rămâne scrisă de mână: `Camp` pune eticheta ÎNAINTEA controlului,
            iar la o casetă de bifat eticheta stă după — altfel ținta de atingere
            se rupe în două și rândul se citește invers. */}
        <div className="flex items-center gap-2">
          <input
            id={idc("tva")}
            type="checkbox"
            {...register("platitor_tva")}
            className={clasaBifa}
          />
          <label htmlFor={idc("tva")} className="text-foreground text-corp">
            Plătitor de TVA
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="slug"
            id={idc("slug")}
            eticheta="Identificator"
            obligatoriu
            erori={mesajeEroare(errors.slug?.message)}
          >
            {(a) => <input {...a} {...register("slug")} placeholder="firma-mea" />}
          </Camp>
          <Camp
            nume="reg_com"
            id={idc("regcom")}
            eticheta="Nr. Registrul Comerțului"
            erori={mesajeEroare(errors.reg_com?.message)}
          >
            {(a) => <input {...a} {...register("reg_com")} placeholder="J40/1234/2020" />}
          </Camp>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="capital_social"
            id={idc("capital")}
            eticheta="Capital social (RON)"
            erori={mesajeEroare(errors.capital_social?.message)}
          >
            {(a) => (
              <input {...a} type="number" min={0} step="0.01" {...register("capital_social")} />
            )}
          </Camp>
          <Camp
            nume="cod_caen"
            id={idc("caen")}
            eticheta="Cod CAEN principal"
            obligatoriu
            ajutor="Anumite coduri (IT, Construcții, Agricultură, Industria Alimentară) permit scutiri fiscale per-angajat în modulul de Salarizare."
            erori={mesajeEroare(errors.cod_caen?.message)}
          >
            {(a) => (
              <SelectorCodCaenPrincipal
                id={a.id}
                value={codCaenPrincipal}
                onChange={(cod) => setValue("cod_caen", cod, { shouldValidate: true })}
                ariaInvalid={a["aria-invalid"] === true}
                {...(a["aria-describedby"] === undefined
                  ? {}
                  : { ariaDescribedBy: a["aria-describedby"] })}
              />
            )}
          </Camp>
        </div>

        <Camp
          nume="cod_caen_secundare"
          id={idc("caen-secundare")}
          eticheta="Coduri CAEN secundare"
          {...(formaJuridicaSelectata === "SRL-D"
            ? {
                ajutor:
                  "SRL-D: toate codurile alese trebuie să facă parte din cel mult 5 grupe de activitate (primele 3 cifre ale codului), iar anumite activități sunt excluse prin lege pentru forma debutant.",
              }
            : {})}
          erori={mesajeEroare(errors.cod_caen_secundare?.message)}
        >
          {(a) => (
            <SelectorCodCaenSecundare
              id={a.id}
              value={codCaenSecundare}
              onChange={(coduri) =>
                setValue("cod_caen_secundare", [...coduri], { shouldValidate: true })
              }
              exclude={codCaenPrincipal}
              max={limitaSecundare}
              ariaInvalid={a["aria-invalid"] === true}
            />
          )}
        </Camp>
      </fieldset>

      <fieldset className="border-border rounded-panou space-y-4 border p-4">
        <legend className="text-foreground text-corp px-1 font-medium">
          Contact și sediu social
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="email_contact"
            id={idc("email")}
            eticheta="Email de contact"
            obligatoriu
            erori={mesajeEroare(errors.email_contact?.message)}
          >
            {(a) => <input {...a} type="email" {...register("email_contact")} />}
          </Camp>
          <Camp
            nume="telefon_contact"
            id={idc("telefon")}
            eticheta="Telefon"
            obligatoriu
            erori={mesajeEroare(errors.telefon_contact?.message)}
          >
            {(a) => (
              <input
                {...a}
                type="tel"
                {...register("telefon_contact")}
                placeholder="0721 234 567"
              />
            )}
          </Camp>
          <Camp
            nume="judet"
            id={idc("judet")}
            eticheta="Județ"
            fel="select"
            obligatoriu
            erori={mesajeEroare(errors.judet?.message)}
          >
            {(a) => (
              <select {...a} {...register("judet")}>
                {JUDETE.map((judet) => (
                  <option key={judet} value={judet}>
                    {judet}
                  </option>
                ))}
              </select>
            )}
          </Camp>
          {judetSelectat === "București" && (
            <Camp
              nume="sector"
              id={idc("sector")}
              eticheta="Sector"
              fel="select"
              erori={mesajeEroare(errors.sector?.message)}
            >
              {(a) => (
                <select {...a} {...register("sector")}>
                  <option value="">— Alegeți —</option>
                  {SECTOARE_BUCURESTI.map((sector) => (
                    <option key={sector} value={sector}>
                      Sectorul {sector}
                    </option>
                  ))}
                </select>
              )}
            </Camp>
          )}
          <Camp
            nume="oras"
            id={idc("oras")}
            eticheta="Localitate"
            obligatoriu
            erori={mesajeEroare(errors.oras?.message)}
          >
            {(a) => <input {...a} {...register("oras")} />}
          </Camp>
          <Camp
            nume="cod_postal"
            id={idc("cod-postal")}
            eticheta="Cod poștal"
            erori={mesajeEroare(errors.cod_postal?.message)}
          >
            {(a) => <input {...a} {...register("cod_postal")} />}
          </Camp>
        </div>
        <Camp
          nume="adresa"
          id={idc("adresa")}
          eticheta="Stradă și număr"
          erori={mesajeEroare(errors.adresa?.message)}
        >
          {(a) => <input {...a} {...register("adresa")} />}
        </Camp>
      </fieldset>
    </div>
  );
}
