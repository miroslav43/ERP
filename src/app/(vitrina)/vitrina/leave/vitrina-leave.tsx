"use client";

import { useId, useState } from "react";

import { PlanificatorConcedii } from "@/app/(app)/concedii/calendar/planificator-concedii";
import { absenteLunii } from "@/demo/lume";
import { angajatiVizibili, poateAproba, ROLURI_DEMO, type RolDemo } from "@/demo/roluri";
import { zilelePlanificatorului } from "@/domain/leave/planificator";

/**
 * Ecranul demonstrat.
 *
 * `PlanificatorConcedii` e importat din `(app)`, NU copiat: e chiar componenta
 * pe care o vede un client plătitor. Aici se ține promisiunea „când modific
 * aplicația, se modifică și chenarul" — o coloană nouă, o legendă schimbată sau
 * un prop nou obligatoriu cade la `tsc` în loc să mintă tăcut.
 *
 * Ce NU e componenta reală: COMPOZIȚIA din jur (antetul, filele). Aceea
 * trăiește în `page.tsx`-ul aplicației, care începe cu `requireTenant()` și
 * n-are niciun parametru de date. Se rescrie aici, deci se poate desincroniza —
 * limita e cunoscută și scrisă în spec §4.
 *
 * ── COMUTATORUL DE ROL, ARGUMENTUL COMERCIAL ──────────────────────────────
 * Același calendar, alți oameni pe el: comutatorul nu schimbă un text, schimbă
 * SETUL de angajați vizibili și mesajul despre ce poate face rolul respectiv —
 * exact cum ar arăta ecranul unui client plătitor logat cu roluri diferite.
 * Sursa vocabularului rămâne `src/demo/roluri.ts`, care e la rândul lui
 * verificat contra seed-ului din `0002_authz.sql`, nu o presupunere de-aici.
 *
 * `"use client"` e obligatoriu: starea comutatorului trăiește doar în
 * browserul vizitatorului, nu pe server — vitrina nu are Server Actions.
 */
export function VitrinaConcedii({ azi }: { readonly azi: string }) {
  const [rol, setRol] = useState<RolDemo>("org_admin");
  const idGrup = useId();

  const an = Number(azi.slice(0, 4));
  const luna = Number(azi.slice(5, 7));
  // Fără sărbători și fără zile nelucrătoare speciale: demonstrația nu pretinde
  // un calendar legal complet, iar `zilelePlanificatorului` le acceptă goale.
  const zile = zilelePlanificatorului(an, luna, [], [], []);
  const angajati = angajatiVizibili(rol);
  const vizibili = new Set(angajati.map((a) => a.id));

  // Celulele se filtrează după cine e vizibil: altfel calendarul ar arăta
  // absențe ale unor oameni care nu apar pe niciun rând.
  const toate = absenteLunii(azi);
  const celule = Object.fromEntries(
    Object.entries(toate).filter(([cheie]) => vizibili.has(cheie.split("|")[0] ?? "")),
  );

  return (
    <div className="space-y-4 p-4">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend id={idGrup} className="text-corp text-muted-foreground mb-2">
          Vezi ecranul ca:
        </legend>
        {ROLURI_DEMO.map((r) => (
          <button
            key={r.cheie}
            type="button"
            aria-pressed={rol === r.cheie}
            onClick={() => {
              setRol(r.cheie);
            }}
            className={`rounded-panou text-corp border px-3 py-1.5 ${
              rol === r.cheie ? "bg-foreground text-background" : "border-border"
            }`}
          >
            {r.eticheta}
          </button>
        ))}
      </fieldset>

      <p className="text-muted-foreground text-corp">
        {poateAproba(rol)
          ? "Rolul acesta poate aproba cererile echipei."
          : "Rolul acesta nu poate aproba cereri — doar să depună propriile lui."}
      </p>

      <PlanificatorConcedii zile={zile} angajati={angajati} celule={celule} azi={azi} />
    </div>
  );
}
