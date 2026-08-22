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
import { claseCamp, claseLabel, Eroare } from "./campuri-comune";

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

  return (
    <div className="space-y-6">
      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">Date de identificare</legend>

        <div>
          <label htmlFor={`${idFormular}-name`} className={claseLabel}>
            Denumire *
          </label>
          <input
            id={`${idFormular}-name`}
            {...register("name")}
            aria-invalid={Boolean(errors.name)}
            className={claseCamp}
          />
          <Eroare id={`${idFormular}-name-eroare`} mesaj={errors.name?.message} />
        </div>

        <div>
          <label htmlFor={`${idFormular}-legal-name`} className={claseLabel}>
            Denumire completă (statut) *
          </label>
          <input
            id={`${idFormular}-legal-name`}
            {...register("legal_name")}
            placeholder="SC Compania Mea SRL"
            aria-invalid={Boolean(errors.legal_name)}
            aria-describedby={`${idFormular}-legal-name-ajutor`}
            className={claseCamp}
          />
          <p id={`${idFormular}-legal-name-ajutor`} className="text-muted-foreground mt-1 text-xs">
            Forma juridică completă, exact ca în actul constitutiv — apare pe contracte, adeverințe
            și orice alt document oficial. Denumirea de mai sus rămâne cea afișată în aplicație.
          </p>
          <Eroare id={`${idFormular}-legal-name-eroare`} mesaj={errors.legal_name?.message} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-forma`} className={claseLabel}>
              Formă de organizare *
            </label>
            <select
              id={`${idFormular}-forma`}
              {...register("forma_juridica")}
              className={claseCamp}
            >
              {FORME_JURIDICE.map((forma) => (
                <option key={forma} value={forma}>
                  {forma}
                </option>
              ))}
            </select>
            <Eroare id={`${idFormular}-forma-eroare`} mesaj={errors.forma_juridica?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-cui`} className={claseLabel}>
              CUI / CIF *
            </label>
            <input
              id={`${idFormular}-cui`}
              {...register("cui")}
              placeholder="RO 14399840"
              aria-invalid={Boolean(errors.cui)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-cui-eroare`} mesaj={errors.cui?.message} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id={`${idFormular}-tva`}
            type="checkbox"
            {...register("platitor_tva")}
            className="border-border size-4 rounded"
          />
          <label htmlFor={`${idFormular}-tva`} className="text-foreground text-sm">
            Plătitor de TVA
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-slug`} className={claseLabel}>
              Identificator *
            </label>
            <input
              id={`${idFormular}-slug`}
              {...register("slug")}
              placeholder="firma-mea"
              aria-invalid={Boolean(errors.slug)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-slug-eroare`} mesaj={errors.slug?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-regcom`} className={claseLabel}>
              Nr. Registrul Comerțului
            </label>
            <input
              id={`${idFormular}-regcom`}
              {...register("reg_com")}
              placeholder="J40/1234/2020"
              className={claseCamp}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-capital`} className={claseLabel}>
              Capital social (RON)
            </label>
            <input
              id={`${idFormular}-capital`}
              type="number"
              min={0}
              step="0.01"
              {...register("capital_social")}
              aria-invalid={Boolean(errors.capital_social)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-capital-eroare`} mesaj={errors.capital_social?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-caen`} className={claseLabel}>
              Cod CAEN principal *
            </label>
            <SelectorCodCaenPrincipal
              id={`${idFormular}-caen`}
              value={codCaenPrincipal}
              onChange={(cod) => setValue("cod_caen", cod, { shouldValidate: true })}
              ariaInvalid={Boolean(errors.cod_caen)}
              ariaDescribedBy={`${idFormular}-caen-ajutor`}
            />
            <p id={`${idFormular}-caen-ajutor`} className="text-muted-foreground mt-1 text-xs">
              Anumite coduri (IT, Construcții, Agricultură, Industria Alimentară) permit scutiri
              fiscale per-angajat în modulul de Salarizare.
            </p>
            <Eroare id={`${idFormular}-caen-eroare`} mesaj={errors.cod_caen?.message} />
          </div>
        </div>

        <div>
          <label htmlFor={`${idFormular}-caen-secundare`} className={claseLabel}>
            Coduri CAEN secundare
          </label>
          <SelectorCodCaenSecundare
            id={`${idFormular}-caen-secundare`}
            value={codCaenSecundare}
            onChange={(coduri) =>
              setValue("cod_caen_secundare", [...coduri], { shouldValidate: true })
            }
            exclude={codCaenPrincipal}
            max={limitaSecundare}
            ariaInvalid={Boolean(errors.cod_caen_secundare)}
          />
          {formaJuridicaSelectata === "SRL-D" && (
            <p className="text-muted-foreground mt-1 text-xs">
              SRL-D: toate codurile alese trebuie să facă parte din cel mult 5 grupe de activitate
              (primele 3 cifre ale codului), iar anumite activități sunt excluse prin lege pentru
              forma debutant.
            </p>
          )}
          <Eroare
            id={`${idFormular}-caen-secundare-eroare`}
            mesaj={errors.cod_caen_secundare?.message}
          />
        </div>
      </fieldset>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">
          Contact și sediu social
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-email`} className={claseLabel}>
              Email de contact *
            </label>
            <input
              id={`${idFormular}-email`}
              type="email"
              {...register("email_contact")}
              aria-invalid={Boolean(errors.email_contact)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-email-eroare`} mesaj={errors.email_contact?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-telefon`} className={claseLabel}>
              Telefon *
            </label>
            <input
              id={`${idFormular}-telefon`}
              type="tel"
              {...register("telefon_contact")}
              placeholder="0721 234 567"
              aria-invalid={Boolean(errors.telefon_contact)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-telefon-eroare`} mesaj={errors.telefon_contact?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-judet`} className={claseLabel}>
              Județ *
            </label>
            <select id={`${idFormular}-judet`} {...register("judet")} className={claseCamp}>
              {JUDETE.map((judet) => (
                <option key={judet} value={judet}>
                  {judet}
                </option>
              ))}
            </select>
            <Eroare id={`${idFormular}-judet-eroare`} mesaj={errors.judet?.message} />
          </div>
          {judetSelectat === "București" && (
            <div>
              <label htmlFor={`${idFormular}-sector`} className={claseLabel}>
                Sector
              </label>
              <select id={`${idFormular}-sector`} {...register("sector")} className={claseCamp}>
                <option value="">— Alegeți —</option>
                {SECTOARE_BUCURESTI.map((sector) => (
                  <option key={sector} value={sector}>
                    Sectorul {sector}
                  </option>
                ))}
              </select>
              <Eroare id={`${idFormular}-sector-eroare`} mesaj={errors.sector?.message} />
            </div>
          )}
          <div>
            <label htmlFor={`${idFormular}-oras`} className={claseLabel}>
              Localitate *
            </label>
            <input
              id={`${idFormular}-oras`}
              {...register("oras")}
              aria-invalid={Boolean(errors.oras)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-oras-eroare`} mesaj={errors.oras?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-cod-postal`} className={claseLabel}>
              Cod poștal
            </label>
            <input
              id={`${idFormular}-cod-postal`}
              {...register("cod_postal")}
              className={claseCamp}
            />
          </div>
        </div>
        <div>
          <label htmlFor={`${idFormular}-adresa`} className={claseLabel}>
            Stradă și număr
          </label>
          <input id={`${idFormular}-adresa`} {...register("adresa")} className={claseCamp} />
        </div>
      </fieldset>
    </div>
  );
}
