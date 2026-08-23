// src/app/(platform)/super-admin/organizatii/[orgId]/_components/formular-editeaza-organizatie.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { JUDETE, PLANURI } from "@/schemas/organization";
import { maximSecundare } from "@/domain/organization/caen-reguli";
import {
  SelectorCodCaenPrincipal,
  SelectorCodCaenSecundare,
} from "@/components/forms/selector-cod-caen";
import { Buton } from "@/components/ui/buton";
import { actualizeazaOrganizatie } from "../../actions";

const ETICHETE_PLAN: Record<(typeof PLANURI)[number], string> = {
  trial: "Perioadă de probă",
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

interface OrganizatieExistenta {
  readonly orgId: string;
  readonly name: string;
  readonly legal_name: string | null;
  readonly email_contact: string | null;
  readonly telefon_contact: string | null;
  readonly judet: string | null;
  readonly oras: string | null;
  readonly adresa: string | null;
  readonly cod_postal: string | null;
  readonly website: string | null;
  readonly reprezentant_legal: string | null;
  readonly plan: string;
  readonly seats_limit: number;
  readonly zile_concediu_anual_implicit: number;
  readonly forma_juridica: string | null;
  readonly cod_caen: string | null;
  readonly cod_caen_secundare: readonly string[];
}

const CLASA_CAMP =
  "mt-1 w-full rounded-control border border-border bg-background px-3 py-2 text-corp";

export function FormularEditeazaOrganizatie({
  organizatie,
}: {
  readonly organizatie: OrganizatieExistenta;
}) {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idFormular = useId();
  // Nu e react-hook-form — e `<form action={fn}>` cu FormData, care nu poate
  // duce natural un array. Cele două câmpuri CAEN se citesc din closure, nu
  // din `fd`, în `trimite`.
  const [codCaen, setCodCaen] = useState<string | undefined>(organizatie.cod_caen ?? undefined);
  const [codCaenSecundare, setCodCaenSecundare] = useState<readonly string[]>(
    organizatie.cod_caen_secundare,
  );
  const limitaSecundare = maximSecundare(organizatie.forma_juridica ?? "SRL");

  function trimite(fd: FormData): void {
    setEroare(null);
    const text = (cheie: string) => {
      const v = String(fd.get(cheie) ?? "").trim();
      return v.length === 0 ? undefined : v;
    };
    porneste(async () => {
      const rezultat = await actualizeazaOrganizatie({
        orgId: organizatie.orgId,
        name: String(fd.get("name") ?? ""),
        legal_name: text("legal_name"),
        email_contact: String(fd.get("email_contact") ?? ""),
        telefon_contact: String(fd.get("telefon_contact") ?? ""),
        judet: String(fd.get("judet") ?? ""),
        oras: String(fd.get("oras") ?? ""),
        adresa: text("adresa"),
        cod_postal: text("cod_postal"),
        website: text("website"),
        reprezentant_legal: text("reprezentant_legal"),
        plan: String(fd.get("plan") ?? ""),
        seats_limit: Number(fd.get("seats_limit")),
        zile_concediu_anual_implicit: Number(fd.get("zile_concediu_anual_implicit")),
        forma_juridica: organizatie.forma_juridica ?? undefined,
        cod_caen: codCaen,
        cod_caen_secundare: [...codCaenSecundare],
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setDeschis(false);
      router.refresh();
    });
  }

  if (!deschis) {
    return (
      <Buton
        varianta="secundar"
        onClick={() => {
          setDeschis(true);
        }}
      >
        Editează datele
      </Buton>
    );
  }

  return (
    <form
      action={trimite}
      className="border-border bg-surface rounded-panou grid gap-3 border p-4 sm:grid-cols-2"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idFormular}-name`} className="text-corp font-medium">
          Denumire *
        </label>
        <input
          id={`${idFormular}-name`}
          name="name"
          required
          maxLength={120}
          defaultValue={organizatie.name}
          className={CLASA_CAMP}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idFormular}-legal_name`} className="text-corp font-medium">
          Denumire legală
        </label>
        <input
          id={`${idFormular}-legal_name`}
          name="legal_name"
          maxLength={160}
          defaultValue={organizatie.legal_name ?? ""}
          className={CLASA_CAMP}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idFormular}-email`} className="text-corp font-medium">
          Email de contact *
        </label>
        <input
          id={`${idFormular}-email`}
          name="email_contact"
          type="email"
          required
          defaultValue={organizatie.email_contact ?? ""}
          className={CLASA_CAMP}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idFormular}-telefon`} className="text-corp font-medium">
          Telefon *
        </label>
        <input
          id={`${idFormular}-telefon`}
          name="telefon_contact"
          required
          defaultValue={organizatie.telefon_contact ?? ""}
          className={CLASA_CAMP}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idFormular}-judet`} className="text-corp font-medium">
          Județ *
        </label>
        <select
          id={`${idFormular}-judet`}
          name="judet"
          required
          defaultValue={organizatie.judet ?? ""}
          className={CLASA_CAMP}
        >
          {JUDETE.map((judet) => (
            <option key={judet} value={judet}>
              {judet}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idFormular}-oras`} className="text-corp font-medium">
          Localitate *
        </label>
        <input
          id={`${idFormular}-oras`}
          name="oras"
          required
          defaultValue={organizatie.oras ?? ""}
          className={CLASA_CAMP}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idFormular}-adresa`} className="text-corp font-medium">
          Adresă
        </label>
        <input
          id={`${idFormular}-adresa`}
          name="adresa"
          maxLength={240}
          defaultValue={organizatie.adresa ?? ""}
          className={CLASA_CAMP}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idFormular}-cod_postal`} className="text-corp font-medium">
          Cod poștal
        </label>
        <input
          id={`${idFormular}-cod_postal`}
          name="cod_postal"
          maxLength={10}
          defaultValue={organizatie.cod_postal ?? ""}
          className={CLASA_CAMP}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idFormular}-website`} className="text-corp font-medium">
          Website
        </label>
        <input
          id={`${idFormular}-website`}
          name="website"
          type="url"
          defaultValue={organizatie.website ?? ""}
          className={CLASA_CAMP}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idFormular}-reprezentant`} className="text-corp font-medium">
          Reprezentant legal
        </label>
        <input
          id={`${idFormular}-reprezentant`}
          name="reprezentant_legal"
          maxLength={120}
          defaultValue={organizatie.reprezentant_legal ?? ""}
          className={CLASA_CAMP}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idFormular}-caen`} className="text-corp font-medium">
          Cod CAEN principal
        </label>
        <SelectorCodCaenPrincipal id={`${idFormular}-caen`} value={codCaen} onChange={setCodCaen} />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor={`${idFormular}-caen-secundare`} className="text-corp font-medium">
          Coduri CAEN secundare
        </label>
        <SelectorCodCaenSecundare
          id={`${idFormular}-caen-secundare`}
          value={codCaenSecundare}
          onChange={setCodCaenSecundare}
          exclude={codCaen}
          max={limitaSecundare}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idFormular}-plan`} className="text-corp font-medium">
          Plan *
        </label>
        <select
          id={`${idFormular}-plan`}
          name="plan"
          required
          defaultValue={organizatie.plan}
          className={CLASA_CAMP}
        >
          {PLANURI.map((plan) => (
            <option key={plan} value={plan}>
              {ETICHETE_PLAN[plan]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idFormular}-locuri`} className="text-corp font-medium">
          Număr de locuri *
        </label>
        <input
          id={`${idFormular}-locuri`}
          name="seats_limit"
          type="number"
          min={1}
          max={1000}
          required
          defaultValue={organizatie.seats_limit}
          className={CLASA_CAMP}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idFormular}-zile_concediu`} className="text-corp font-medium">
          Zile de concediu de odihnă / an *
        </label>
        <input
          id={`${idFormular}-zile_concediu`}
          name="zile_concediu_anual_implicit"
          type="number"
          min={0}
          max={60}
          required
          defaultValue={organizatie.zile_concediu_anual_implicit}
          className={CLASA_CAMP}
        />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
          Salvează modificările
        </Buton>
        <Buton
          varianta="link"
          onClick={() => {
            setDeschis(false);
            setEroare(null);
          }}
        >
          Renunță
        </Buton>
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-corp">
            {eroare}
          </p>
        )}
      </div>
    </form>
  );
}
