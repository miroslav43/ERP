// src/app/(platform)/super-admin/organizatii/_components/inrolare-organizatie.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormularCautareCui } from "./formular-cautare-cui";
import {
  FormularOrganizatieNoua,
  type ValoriInitialeOrganizatie,
} from "./formular-organizatie-noua";
import type { RezultatCautareCui, OrganizatieInrolata } from "./../actions";

type Pas =
  | Readonly<{ nume: "cui" }>
  | Readonly<{ nume: "confirmare"; cautare: RezultatCautareCui }>
  | Readonly<{ nume: "succes"; rezultat: OrganizatieInrolata }>;

interface Proprietati {
  readonly valoriInitiale?: ValoriInitialeOrganizatie;
}

export function InrolareOrganizatie({ valoriInitiale }: Proprietati) {
  const router = useRouter();
  const [pas, setPas] = useState<Pas>({ nume: "cui" });

  if (pas.nume === "cui") {
    return <FormularCautareCui onGasit={(cautare) => setPas({ nume: "confirmare", cautare })} />;
  }

  if (pas.nume === "confirmare") {
    const { anaf } = pas.cautare;
    const valoriDinAnaf: ValoriInitialeOrganizatie = {
      name: anaf?.denumire ?? valoriInitiale?.name ?? "",
      slug: valoriInitiale?.slug ?? "",
      email_contact: valoriInitiale?.email_contact ?? "",
      telefon_contact: valoriInitiale?.telefon_contact ?? "",
    };
    return (
      <FormularOrganizatieNoua
        valoriInitiale={valoriDinAnaf}
        onInrolata={(rezultat) => setPas({ nume: "succes", rezultat })}
      />
    );
  }

  const { rezultat } = pas;
  return (
    <div className="border-border bg-surface max-w-md space-y-4 rounded-lg border p-6">
      <h2 className="text-foreground text-lg font-semibold">
        Organizația „{rezultat.name}” a fost înrolată
      </h2>
      <p className="text-muted-foreground text-sm">
        Comunică parola temporară de mai jos proprietarului ({rezultat.ownerEmail}). Va fi obligat
        să și-o schimbe la primul login — nu mai poate fi afișată din nou după ce părăsești
        această pagină.
      </p>
      <p className="border-border bg-background rounded-md border p-3 font-mono text-sm break-all">
        {rezultat.parolaTemporara}
      </p>
      <button
        type="button"
        onClick={() => router.push(`/super-admin/organizatii/${rezultat.id}`)}
        className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-4 py-2 text-sm font-medium"
      >
        Am notat parola, continuă
      </button>
    </div>
  );
}
