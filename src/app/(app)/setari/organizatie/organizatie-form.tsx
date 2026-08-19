// src/app/(app)/setari/organizatie/organizatie-form.tsx
"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Save } from "lucide-react";

import { actualizeazaOrganizatia } from "./actions";

export type ValoriOrganizatie = Readonly<{
  name: string;
  legal_name: string;
  forma_juridica: string;
  cui: string;
  platitor_tva: boolean;
  reg_com: string;
  adresa: string;
  judet: string;
  oras: string;
  cod_postal: string;
  tara: string;
  email_contact: string;
  telefon_contact: string;
  website: string;
  reprezentant_legal: string;
  capital_social: string;
  cod_caen: string;
  sector: string;
  functie_reprezentant_legal: string;
  ssm_furnizor_extern: string;
  ssm_persoana_responsabila: string;
  zile_concediu_anual_implicit: string;
}>;

type CheiText = Exclude<keyof ValoriOrganizatie, "platitor_tva">;

const ETICHETE: Readonly<Record<CheiText, string>> = {
  name: "Denumire comercială",
  legal_name: "Denumire legală",
  forma_juridica: "Formă juridică",
  cui: "CUI",
  reg_com: "Nr. Registrul Comerțului",
  adresa: "Adresă",
  judet: "Județ",
  oras: "Oraș",
  cod_postal: "Cod poștal",
  tara: "Țară",
  email_contact: "E-mail de contact",
  telefon_contact: "Telefon de contact",
  website: "Site web",
  reprezentant_legal: "Reprezentant legal",
  capital_social: "Capital social (RON)",
  cod_caen: "Cod CAEN",
  sector: "Sector (doar București)",
  functie_reprezentant_legal: "Funcția reprezentantului legal",
  ssm_furnizor_extern: "Furnizor medicina muncii",
  ssm_persoana_responsabila: "Serviciu extern SSM/PSI",
  zile_concediu_anual_implicit: "Zile de concediu anual, implicit",
};

/** Randate ca `<input type="number">` — restul câmpurilor din `ORDINE` sunt text. */
const CAMPURI_NUMERICE: ReadonlySet<CheiText> = new Set(["capital_social", "zile_concediu_anual_implicit"]);

const ORDINE: readonly CheiText[] = [
  "name",
  "legal_name",
  "forma_juridica",
  "cui",
  "reg_com",
  "reprezentant_legal",
  "functie_reprezentant_legal",
  "capital_social",
  "cod_caen",
  "adresa",
  "oras",
  "judet",
  "sector",
  "cod_postal",
  "tara",
  "email_contact",
  "telefon_contact",
  "website",
  "ssm_furnizor_extern",
  "ssm_persoana_responsabila",
  "zile_concediu_anual_implicit",
];

type StareFormular = Readonly<{
  mesaj: string | null;
  esteEroare: boolean;
  erori: Readonly<Record<string, readonly string[]>> | null;
}>;

function Camp({
  eticheta,
  id,
  erori,
  children,
}: Readonly<{
  eticheta: string;
  id: string;
  erori: readonly string[] | undefined;
  children: ReactNode;
}>) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-foreground text-sm font-medium">
        {eticheta}
      </label>
      {children}
      {erori !== undefined && erori.length > 0 ? (
        <p id={`${id}-eroare`} className="text-danger text-sm">
          {erori.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

export function FormularOrganizatie({ initiale }: Readonly<{ initiale: ValoriOrganizatie }>) {
  const [valori, setValori] = useState<ValoriOrganizatie>(initiale);
  const [stare, setStare] = useState<StareFormular>({
    mesaj: null,
    esteEroare: false,
    erori: null,
  });
  const [seSalveaza, startTransition] = useTransition();

  function trimite(eveniment: React.FormEvent<HTMLFormElement>): void {
    eveniment.preventDefault();
    startTransition(async () => {
      const rezultat = await actualizeazaOrganizatia(valori);
      if (rezultat.ok) {
        setStare({ mesaj: "Datele firmei au fost salvate.", esteEroare: false, erori: null });
        return;
      }
      setStare({
        mesaj: rezultat.error.message,
        esteEroare: true,
        erori: rezultat.error.fieldErrors,
      });
    });
  }

  return (
    <form onSubmit={trimite} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        {ORDINE.map((cheie) => {
          const id = `org-${cheie}`;
          const erori = stare.erori?.[cheie];
          return (
            <Camp key={cheie} id={id} eticheta={ETICHETE[cheie]} erori={erori}>
              <input
                id={id}
                name={cheie}
                type={
                  cheie === "email_contact"
                    ? "email"
                    : cheie === "website"
                      ? "url"
                      : CAMPURI_NUMERICE.has(cheie)
                        ? "number"
                        : "text"
                }
                value={valori[cheie]}
                onChange={(eveniment) =>
                  setValori((precedente) => ({ ...precedente, [cheie]: eveniment.target.value }))
                }
                aria-invalid={erori !== undefined && erori.length > 0}
                aria-describedby={
                  erori !== undefined && erori.length > 0 ? `${id}-eroare` : undefined
                }
                className="border-border bg-surface text-foreground h-9 rounded-md border px-3 text-sm"
              />
            </Camp>
          );
        })}

        <div className="flex items-center gap-2">
          <input
            id="org-platitor-tva"
            type="checkbox"
            checked={valori.platitor_tva}
            onChange={(eveniment) =>
              setValori((precedente) => ({ ...precedente, platitor_tva: eveniment.target.checked }))
            }
            className="border-border h-4 w-4 rounded"
          />
          <label htmlFor="org-platitor-tva" className="text-foreground text-sm">
            Plătitor de TVA
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={seSalveaza}
          className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
        >
          <Save aria-hidden="true" className="h-4 w-4" />
          {seSalveaza ? "Se salvează…" : "Salvează modificările"}
        </button>
        <p
          role="status"
          aria-live="polite"
          className={`text-sm ${stare.esteEroare ? "text-danger" : "text-success"}`}
        >
          {stare.mesaj ?? ""}
        </p>
      </div>
    </form>
  );
}
