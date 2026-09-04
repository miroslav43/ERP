import { PlanificatorConcedii } from "@/app/(app)/concedii/calendar/planificator-concedii";
import { zilelePlanificatorului } from "@/domain/leave/planificator";
import { absenteLunii, ANGAJATI } from "@/demo/lume";

/**
 * Ecranul demonstrat.
 *
 * `PlanificatorConcedii` e importat din `(app)`, NU copiat: e chiar componenta
 * pe care o vede un client plătitor. Aici se ține promisiunea „când modific
 * aplicația, se modifică și chenarul" — o coloană nouă, o legendă schimbată sau
 * un token de culoare mutat apar aici fără ca cineva să atingă vitrina, iar un
 * prop nou obligatoriu cade la `tsc` în loc să mintă tăcut.
 *
 * Ce NU e componenta reală: COMPOZIȚIA din jur (antetul, filele). Aceea
 * trăiește în `page.tsx`-ul aplicației, care începe cu `requireTenant()` și
 * n-are niciun parametru de date. Se rescrie aici, deci se poate desincroniza —
 * limita e cunoscută și scrisă în spec §4.
 */
export function VitrinaConcedii({ azi }: { readonly azi: string }) {
  const an = Number(azi.slice(0, 4));
  const luna = Number(azi.slice(5, 7));
  // Fără sărbători și fără zile nelucrătoare speciale: demonstrația nu pretinde
  // un calendar legal complet, iar `zilelePlanificatorului` le acceptă goale.
  const zile = zilelePlanificatorului(an, luna, [], [], []);
  const celule = absenteLunii(azi);

  return (
    <div className="space-y-4 p-4">
      <PlanificatorConcedii zile={zile} angajati={ANGAJATI} celule={celule} azi={azi} />
    </div>
  );
}
