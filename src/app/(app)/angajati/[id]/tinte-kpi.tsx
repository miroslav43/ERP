// src/app/(app)/angajati/[id]/tinte-kpi.tsx
import Link from "next/link";

import { setPentruAngajat, tinteleAngajatului } from "@/lib/queries/kpi";

import { FormularTintaKpi } from "./formular-tinta-kpi";

/**
 * Secțiunea „Ținte KPI” de pe fișa angajatului: setul funcției lui, cu ținta
 * proprie editabilă pe fiecare indicator. Apelantul o montează doar prin
 * poarta acțiunii (modulul `kpi` + `evaluations:update ≥ team`); acțiunea
 * verifică din nou, iar RLS refuză managerul din afara subarborelui.
 */
export async function TinteKpi({
  organizationId,
  employeeId,
  hrefSeturi,
  className,
}: Readonly<{
  organizationId: string;
  employeeId: string;
  /** `/evaluari/kpi/seturi`, când se deschide pentru rol; `null` = text. */
  hrefSeturi: string | null;
  className?: string;
}>) {
  const [aplicabil, tinte] = await Promise.all([
    setPentruAngajat(organizationId, employeeId),
    tinteleAngajatului(organizationId, employeeId),
  ]);

  return (
    <section aria-labelledby="titlu-tinte-kpi" className={className}>
      <h2 id="titlu-tinte-kpi" className="text-sectiune mb-1 font-medium">
        Ținte KPI
      </h2>
      {aplicabil.set === null ? (
        <p className="text-muted-foreground text-corp">
          {aplicabil.motiv === "fara_functie"
            ? "Fișa n-are funcția completată, iar indicatorii se stabilesc pe funcție."
            : "Funcția n-are încă un set de indicatori."}
          {hrefSeturi === null ? null : (
            <>
              {" "}
              <Link href={hrefSeturi} className="underline underline-offset-2">
                Seturile de indicatori
              </Link>
              .
            </>
          )}
        </p>
      ) : (
        <>
          <p className="text-muted-foreground text-corp mb-3">
            Setul „{aplicabil.set.denumire}”. O țintă pusă aici bate ținta setului doar pentru acest
            angajat, de luna următoare.
            {hrefSeturi === null ? null : (
              <>
                {" "}
                <Link href={hrefSeturi} className="underline underline-offset-2">
                  Setul funcției
                </Link>
                .
              </>
            )}
          </p>
          <ul>
            {aplicabil.set.indicatori
              .filter((indicator) => indicator.tip === "masurat")
              .map((indicator) => (
                <FormularTintaKpi
                  key={indicator.id}
                  employeeId={employeeId}
                  indicatorId={indicator.id}
                  denumire={indicator.denumire}
                  unitate={indicator.unitate}
                  tintaImplicita={indicator.tinta_implicita}
                  tinta={tinte.get(indicator.id) ?? null}
                />
              ))}
          </ul>
        </>
      )}
    </section>
  );
}
