// src/app/(platform)/super-admin/organizatii/nou/_components/pas-7-confirmare.tsx
"use client";

import type { UseFormReturn } from "react-hook-form";

import type { OnboardeazaOrganizatieInput } from "@/schemas/organization";

interface Proprietati {
  readonly formular: UseFormReturn<OnboardeazaOrganizatieInput>;
}

function Rand({ eticheta, valoare }: { eticheta: string; valoare: string | undefined }) {
  if (valoare === undefined || valoare === "") return null;
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <dt className="text-muted-foreground">{eticheta}</dt>
      <dd className="text-foreground text-right font-medium">{valoare}</dd>
    </div>
  );
}

/** Recapitulare read-only — nu duplică validarea, doar reflectă ce s-a completat. */
export function Pas7Confirmare({ formular }: Proprietati) {
  const valori = formular.watch();

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Verificați datele înainte de a crea organizația. Puteți reveni la orice pas anterior.
      </p>

      <dl className="border-border divide-border divide-y rounded-lg border p-4">
        <Rand eticheta="Denumire" valoare={valori.name} />
        <Rand eticheta="CUI" valoare={valori.cui} />
        <Rand eticheta="Formă de organizare" valoare={valori.forma_juridica} />
        <Rand eticheta="Cod CAEN" valoare={valori.cod_caen} />
        <Rand
          eticheta="Sediu"
          valoare={[valori.oras, valori.judet].filter(Boolean).join(", ") || undefined}
        />
      </dl>

      <dl className="border-border divide-border divide-y rounded-lg border p-4">
        <Rand eticheta="Reprezentant legal" valoare={valori.reprezentant_legal} />
        <Rand eticheta="Funcție" valoare={valori.functie_reprezentant_legal} />
        <Rand
          eticheta="CNP reprezentant"
          valoare={valori.reprezentant_cnp ? "Completat (criptat la salvare)" : undefined}
        />
      </dl>

      <dl className="border-border divide-border divide-y rounded-lg border p-4">
        <Rand eticheta="Bancă" valoare={valori.banca_nume} />
        <Rand eticheta="IBAN" valoare={valori.banca_iban} />
        <Rand eticheta="Avans" valoare={valori.plata_avans ? "Da" : "Nu"} />
        <Rand eticheta="Tichete de masă" valoare={valori.tichete_furnizor} />
      </dl>

      <dl className="border-border divide-border divide-y rounded-lg border p-4">
        <Rand eticheta="Punct de lucru principal" valoare={valori.punct_lucru_denumire} />
        <Rand
          eticheta="Zile concediu implicit"
          valoare={
            valori.zile_concediu_anual_implicit === undefined
              ? undefined
              : String(valori.zile_concediu_anual_implicit)
          }
        />
        <Rand eticheta="Medicina muncii" valoare={valori.ssm_furnizor_extern} />
        <Rand eticheta="Serviciu SSM/PSI" valoare={valori.ssm_persoana_responsabila} />
      </dl>

      <dl className="border-border divide-border divide-y rounded-lg border p-4">
        <Rand
          eticheta="Proprietar"
          valoare={[valori.owner_prenume, valori.owner_nume].filter(Boolean).join(" ") || undefined}
        />
        <Rand eticheta="Email proprietar" valoare={valori.owner_email} />
        <Rand eticheta="Plan" valoare={valori.plan} />
      </dl>
    </div>
  );
}
