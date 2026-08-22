// src/app/api/export/salarizare/nota/route.ts
//
// Nota contabilă de salarii, ca fișier CSV pentru programul de contabilitate.
//
// Poarta care contează: nota se generează DOAR dacă debitul egalează creditul.
// O notă dezechilibrată nu poate fi înregistrată, iar diferența arată că o sumă
// lipsește sau e numărată de două ori. De aceea un dezechilibru întoarce 409 cu
// cifrele, nu un fișier pe care contabilul l-ar descoperi greșit peste o
// săptămână.
//
// Conturile vin din setările organizației, nu din cod: codurile generale sunt
// aceleași pentru orice firmă, dar analiticele nu se pot presupune.

import { can, getPermissionMap } from "@/lib/auth/permissions";
import { construiesteNota } from "@/domain/payroll/contabil/nota";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const raspunsText = (mesaj: string, status: number): Response =>
  new Response(mesaj, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

/** Excel interpretă „=", „+", „-", „@" ca formule: le prefixăm cu apostrof. */
const celula = (valoare: string): string => {
  const curat = valoare.replace(/\r?\n/g, " ");
  const protejat = /^[=+\-@\t]/.test(curat) ? `'${curat}` : curat;
  return `"${protejat.replace(/"/g, '""')}"`;
};

export async function GET(cerere: Request): Promise<Response> {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "payroll");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "payroll:export", "all")) {
    return raspunsText("Nu aveți dreptul de a exporta salarii.", 403);
  }

  const periodId = new URL(cerere.url).searchParams.get("perioada");
  if (periodId === null) return raspunsText("Lipsește identificatorul perioadei.", 400);

  const db = await createServerSupabase();
  const { data: perioada, error: eroarePerioada } = await db
    .from("payroll_periods")
    .select("id, an, luna, status, settings_id")
    .eq("organization_id", tenant.organizationId)
    .eq("id", periodId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; an: number; luna: number; status: string; settings_id: string }>();
  if (eroarePerioada !== null) return raspunsText("Perioada nu a putut fi citită.", 500);
  if (perioada === null) return raspunsText("Perioada nu există sau nu aveți acces la ea.", 404);
  if (perioada.status !== "aprobat" && perioada.status !== "inchis") {
    return raspunsText("Nota contabilă se generează doar peste o perioadă aprobată.", 409);
  }

  const [{ data: randuri, error: eroareRanduri }, { data: setari }] = await Promise.all([
    db
      .from("payroll_entries")
      .select("brut, cas, cass, impozit, cam_angajator, retineri_total, rest_de_plata")
      .eq("organization_id", tenant.organizationId)
      .eq("period_id", perioada.id)
      .is("deleted_at", null)
      .returns<
        {
          brut: number;
          cas: number;
          cass: number;
          impozit: number;
          cam_angajator: number;
          retineri_total: number;
          rest_de_plata: number;
        }[]
      >(),
    db
      .from("payroll_settings")
      .select(
        "cont_cheltuiala_salarii, cont_cheltuiala_contributie_angajator, cont_salarii_datorate, cont_cas_retinut, cont_cass_retinut, cont_impozit, cont_retineri_terti, cont_avansuri",
      )
      .eq("id", perioada.settings_id)
      .maybeSingle(),
  ]);
  if (eroareRanduri !== null)
    return raspunsText("Rândurile de salariu nu au putut fi citite.", 500);
  if (setari === null) return raspunsText("Planul de conturi nu a putut fi citit.", 500);

  const aduna = (camp: keyof (typeof randuri)[number]): number =>
    (randuri ?? []).reduce((total, r) => total + r[camp], 0);

  const rezultat = construiesteNota(
    {
      brut: aduna("brut"),
      cas: aduna("cas"),
      cass: aduna("cass"),
      impozit: aduna("impozit"),
      camAngajator: aduna("cam_angajator"),
      // Avansurile nu sunt separate de restul reținerilor în `payroll_entries`;
      // până când vor fi, intră toate la reținerile către terți. Suma totală e
      // corectă, defalcarea nu — și e mai bine să fie spus decât presupus.
      avansuri: 0,
      retineriTerti: aduna("retineri_total"),
      restDePlata: aduna("rest_de_plata"),
    },
    {
      cheltuialaSalarii: setari.cont_cheltuiala_salarii,
      cheltuialaContributieAngajator: setari.cont_cheltuiala_contributie_angajator,
      salariiDatorate: setari.cont_salarii_datorate,
      casRetinut: setari.cont_cas_retinut,
      cassRetinut: setari.cont_cass_retinut,
      impozit: setari.cont_impozit,
      retineriTerti: setari.cont_retineri_terti,
      avansuri: setari.cont_avansuri,
    },
  );

  if (!rezultat.echilibrata) {
    const motive = rezultat.probleme.map((p) => `${p.cod}: ${p.detalii}`).join("\n");
    return raspunsText(
      `Nota nu închide, deci nu a fost generată.\n\nDebit ${rezultat.totalDebit.toFixed(2)} lei, credit ${rezultat.totalCredit.toFixed(2)} lei.\n\n${motive}`,
      409,
    );
  }

  const eticheta = `${String(perioada.luna).padStart(2, "0")}.${String(perioada.an)}`;
  const linii = [
    ["Cont", "Debit", "Credit", "Explicație"].map(celula).join(";"),
    ...rezultat.linii.map((l) =>
      [l.cont, l.debit.toFixed(2), l.credit.toFixed(2), l.explicatie].map(celula).join(";"),
    ),
  ];
  // BOM, ca Excel să deschidă fișierul cu diacriticele corecte.
  const csv = `﻿${linii.join("\r\n")}\r\n`;

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="nota-salarii-${eticheta}.csv"`,
      "cache-control": "no-store",
    },
  });
}
