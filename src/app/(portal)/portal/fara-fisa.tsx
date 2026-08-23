// src/app/(portal)/portal/fara-fisa.tsx
import type { StareFisa } from "@/lib/queries/portal";

/**
 * Ce vede cineva care intră în portal fără o fișă de personal utilizabilă.
 *
 * Două stări, două mesaje — și distincția chiar contează. „Nu aveți fișă" e
 * fals și derutant pentru un om care își vede marca pe ecran, iar el n-are cum
 * să ghicească ce e o „fișă principală". Textul îi spune ce să ceară, cui, și
 * de ce.
 *
 * Cauza tehnică, pentru cine citește codul: `app.current_employee_id()`
 * (`0005_hr_rls.sql:16-30`) cere `is_primary`, iar prin ea trec toate ramurile
 * `own` din RLS. Fișa se citește după `user_id`, deci numele și marca apar; dar
 * fiecare listă rămâne goală și fiecare scriere e refuzată, tăcut.
 */
export function FaraFisa({
  stare,
  numeOrganizatie,
}: {
  readonly stare: Extract<StareFisa, { stare: "fara_fisa" | "fara_principala" }>;
  readonly numeOrganizatie: string;
}) {
  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="bg-surface border-border rounded-panou border p-6 text-center">
        {stare.stare === "fara_fisa" ? (
          <>
            <h1 className="text-foreground text-sectiune font-semibold">
              Nu aveți încă o fișă de personal
            </h1>
            <p className="text-muted-foreground text-corp mt-2">
              Contul dumneavoastră are acces la {numeOrganizatie}, dar nu este legat de un angajat.
              Cereți departamentului de resurse umane să vă completeze fișa.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-foreground text-sectiune font-semibold">
              Fișa dumneavoastră nu este marcată drept principală
            </h1>
            <p className="text-muted-foreground text-corp mt-2">
              Aveți fișa cu marca {stare.marca} în {numeOrganizatie}, dar sistemul nu vă poate
              identifica pornind de la ea, așa că nu vă poate arăta concediile, pontajul sau
              salariul. Cereți departamentului de resurse umane să o marcheze drept fișă principală.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
