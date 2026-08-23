// src/app/(app)/salarizare/istoric-venituri/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatLei } from "@/lib/format/money";
import { formatMonthYear, todayInBucharest } from "@/lib/format/date";
import {
  angajatiActiviCuContract,
  listeazaIstoricVenit,
  type RandIstoricVenit,
} from "@/lib/queries/payroll";
import { CalendarClock } from "lucide-react";

import { FormularIstoricVenit } from "./formular-istoric-venit";

export const metadata: Metadata = { title: "Istoric venituri" };

export default async function PaginaIstoricVenituri() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "payroll");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "payroll:create", "all")) {
    return (
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a introduce istoricul de venit." />
      </div>
    );
  }

  const azi = todayInBucharest();
  const an = Number(azi.slice(0, 4));
  const luna = Number(azi.slice(5, 7));
  const [personal, randuri] = await Promise.all([
    angajatiActiviCuContract(tenant.organizationId, an, luna),
    listeazaIstoricVenit(tenant.organizationId),
  ]);

  /*
   * Citirea ia lista întreagă (fără cursor keyset), deci antetele nu pretind că
   * sortează. Cele trei coloane de cifre sunt `numeric`: veniturile se compară
   * pe verticală, nu una câte una.
   */
  const coloane: readonly Coloana<RandIstoricVenit>[] = [
    {
      cheie: "angajat",
      antet: "Angajat",
      peTelefon: "titlu",
      celula: (rand) => rand.nume || rand.marca,
    },
    {
      cheie: "luna",
      antet: "Luna",
      peTelefon: "meta",
      celula: (rand) => formatMonthYear(rand.an, rand.luna),
    },
    {
      cheie: "venit_brut",
      antet: "Venit brut",
      numeric: true,
      peTelefon: "meta",
      celula: (rand) => formatLei(rand.venit_brut),
    },
    {
      cheie: "drepturi_salariale",
      antet: "Drepturi salariale",
      numeric: true,
      peTelefon: "meta",
      celula: (rand) => formatLei(rand.drepturi_salariale),
    },
    {
      cheie: "zile_lucrate",
      antet: "Zile lucrate",
      numeric: true,
      peTelefon: "meta",
      celula: (rand) => rand.zile_lucrate,
    },
  ];

  return (
    <div className={`${LATIMI.detaliu} space-y-6`}>
      <div className="space-y-1">
        <p className="text-muted-foreground text-corp">
          <Link href="/salarizare" className="underline-offset-2 hover:underline">
            Salarizare
          </Link>
        </p>
        <AntetPagina titlu="Istoric venituri" />
        {/* Rămâne un `<p>` de sine stătător, nu prop-ul `descriere`: accentul pe
            „înainte” e purtat de `<strong>`, iar `descriere` primește un string. */}
        <p className="text-muted-foreground text-corp mt-2 max-w-prose text-pretty">
          Veniturile realizate <strong>înainte</strong> ca firma să folosească aplicația.
          Indemnizația de concediu medical se calculează pe media ultimelor șase luni, iar cea de
          concediu de odihnă pe media ultimelor trei. Fără lunile acestea, mediile ies incomplete și
          indemnizațiile mai mici decât cele legale — fără nicio eroare vizibilă.
        </p>
      </div>

      <FormularIstoricVenit angajati={personal.angajati} />

      <section aria-label="Rânduri introduse">
        <Tabel
          caption="Veniturile lunare introduse manual, pentru perioada dinaintea aplicației"
          coloane={coloane}
          randuri={randuri}
          cheieRand={(rand) => rand.id}
          densitate="compact"
          // `listeazaIstoricVenit` taie la 500 de rânduri fără să spună. Într-un
          // modul unde din rândurile astea ies mediile de indemnizație, o listă
          // tăiată tăcut e o cifră greșită fără eroare.
          trunchiat={randuri.length >= 500}
          gol={
            <StareGoala
              fel="initiala"
              pictograma={CalendarClock}
              titlu="Niciun rând încă"
              descriere="Introduceți lunile anterioare pentru angajații care au avut sau ar putea avea concediu medical."
            />
          }
        />
      </section>
    </div>
  );
}
