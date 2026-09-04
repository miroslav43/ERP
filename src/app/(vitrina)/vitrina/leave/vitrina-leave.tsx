"use client";

import { useCallback, useEffect, useId, useState } from "react";

import { PlanificatorConcedii } from "@/app/(app)/concedii/calendar/planificator-concedii";
import { CHEIE_CONCEDII, citesteDepozit, scrieDepozit } from "@/demo/depozit";
import { absenteLunii, TIPURI } from "@/demo/lume";
import { angajatiVizibili, poateAproba, poateCrea, ROLURI_DEMO, type RolDemo } from "@/demo/roluri";
import {
  cheieCelula,
  zilelePlanificatorului,
  type AbsentaCelula,
} from "@/domain/leave/planificator";

import { FormularCerereDemo, type CerereDemo } from "./formular-cerere-demo";

/**
 * `iso` (`YYYY-MM-DD`) → `Date` ancorată la miezul nopții UTC.
 *
 * `new Date(iso)` face deja asta pentru PARSARE, dar `setDate`/`getDate` merg
 * pe fusul ORAR LOCAL — pe o mașină la vest de UTC (orice fus american),
 * miezul nopții UTC cade în ziua locală PRECEDENTĂ, iar bucla de mai jos ar
 * porni și s-ar opri cu o zi în minus. `setUTCDate`/`getUTCDate` rămân în
 * același fus în care s-a făcut parsarea.
 */
function laMiezulNoptiiUtc(iso: string): Date {
  const [an, luna, zi] = iso.split("-").map(Number);
  return new Date(Date.UTC(an ?? 0, (luna ?? 1) - 1, zi ?? 1));
}

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

  /*
   * Cererile depuse ÎN ACEASTĂ SESIUNE. `sessionStorage` (prin
   * `citesteDepozit`) le ține peste o reîncărcare a filei, dar le uită la
   * închiderea ei — exact promisiunea de pe pagina publică: „nimic nu pleacă
   * spre server, nimic nu supraviețuiește sesiunii".
   *
   * ── DE CE STAREA PORNEȘTE GOALĂ, ȘI NU CITITĂ DIN DEPOZIT ────────────────
   * Inițializatorul lui `useState` rulează ȘI la randarea pe server, unde
   * `sessionStorage` nu există: `catch`-ul din `citesteDepozit` întorcea `[]`,
   * deci HTML-ul trimis are ÎNTOTDEAUNA zero cereri. Citit înapoi în
   * inițializator, primul render de client putea găsi una și desena celule în
   * plus — altă structură decât HTML-ul primit. În React 19 nepotrivirea de
   * hidratare nu e un avertisment: aruncă, iar ce cade e tot arborele din
   * iframe, adică chenarul „Ecran real" de pe pagina de vânzare.
   *
   * Tiparul e cel din `(marketing)/_componente/bara-consimtamant.tsx:42-48`:
   * starea inițială e EXACT ce randează serverul, iar depozitul se citește
   * după montare, într-un cadru de animație. Amânarea cu `requestAnimationFrame`
   * nu e cosmetică — un `setState` sincron într-un efect e respins de lint și
   * produce o a doua randare imediată la fiecare montare.
   *
   * (`useSyncExternalStore` cu instantaneu de server — tiparul din
   * `(portal)/portal/indemn-instalare.tsx:92-95` — ar fi rezolvat la fel de
   * corect nepotrivirea, dar e făcut pentru o sursă externă care SE SCHIMBĂ și
   * trebuie ascultată. Aici depozitul e scris doar de componenta însăși, deci
   * n-are cine să-l schimbe pe la spate: abonamentul ar fi fost mecanism fără
   * întrebuințare. În plus, în acest proiect s-a măsurat că nu comuta de pe
   * instantaneul de server după hidratare — vezi nota din `bara-consimtamant`.)
   *
   * Garda de formă rămâne obligatorie: mai jos, `cereri` se iterează cu
   * `for...of` — o valoare non-tablou stocată sub aceeași cheie (o sesiune
   * veche, o schemă viitoare) ar arunca `TypeError` și ar cădea tot ecranul
   * public. `Array.isArray` nu verifică FORMA elementelor, doar că e tablou —
   * suficient cât să evite prăbușirea; un element individual greșit tipat tot
   * ar trece, dar acela e un defect de altă natură.
   */
  const [cereri, setCereri] = useState<readonly CerereDemo[]>([]);
  const [casetaDeschisa, setCasetaDeschisa] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      // Se citește depozitul la execuția cadrului, nu o valoare capturată la
      // montare: dacă vizitatorul a apucat să depună o cerere între timp,
      // `scrieDepozit` a trecut deja prin `sessionStorage`, deci citirea de
      // aici o conține — nu o pierde.
      setCereri(citesteDepozit<readonly CerereDemo[]>(CHEIE_CONCEDII, [], Array.isArray));
    });
    return () => {
      cancelAnimationFrame(id);
    };
  }, []);

  // `useCallback` cu deps goale: trece drept `laReusita` lui `Formular`
  // (`src/components/ui/formular.tsx:71`), care intră în lista de dependențe a
  // efectului de reușită. O funcție nouă la fiecare randare ar reporni efectul
  // — vezi tiparul din `formular-dialog.tsx` (`refCallback`), unde aceeași
  // grijă e scrisă din motivul opus: „notificarea ar apărea de două ori".
  const adauga = useCallback((cerere: CerereDemo): void => {
    setCereri((precedente) => {
      const urmatoare = [...precedente, cerere];
      scrieDepozit(CHEIE_CONCEDII, urmatoare);
      return urmatoare;
    });
    setCasetaDeschisa(false);
  }, []);

  const an = Number(azi.slice(0, 4));
  const luna = Number(azi.slice(5, 7));
  // Fără sărbători și fără zile nelucrătoare speciale: demonstrația nu pretinde
  // un calendar legal complet, iar `zilelePlanificatorului` le acceptă goale.
  const zile = zilelePlanificatorului(an, luna, [], [], []);
  // Marginile formularului se iau din GRILA desenată, nu recalculate din `azi`:
  // o cerere în afara lunii desenate s-ar scrie în depozit și n-ar apărea pe
  // nicio celulă — reușită anunțată, calendar neschimbat.
  const primaZi = zile[0]?.iso ?? azi;
  const ultimaZi = zile[zile.length - 1]?.iso ?? azi;
  const angajati = angajatiVizibili(rol);
  const vizibili = new Set(angajati.map((a) => a.id));

  // Celulele se filtrează după cine e vizibil: altfel calendarul ar arăta
  // absențe ale unor oameni care nu apar pe niciun rând.
  const toate = absenteLunii(azi);
  const celule = Object.fromEntries(
    Object.entries(toate).filter(([cheie]) => vizibili.has(cheie.split("|")[0] ?? "")),
  );

  /**
   * Celulele lumii, plus cele depuse în sesiunea asta.
   *
   * Cheile se construiesc cu `cheieCelula`, la fel ca în `lume.ts` — nu de
   * mână. Un format schimbat acolo se propagă singur și aici. Iterarea zilelor
   * merge pe `laMiezulNoptiiUtc`/`setUTCDate`, nu pe `Date` locală: o cerere
   * „2026-03-02 → 2026-03-03” nu are voie să piardă sau să câștige o zi doar
   * fiindcă browserul vizitatorului stă în alt fus orar.
   */
  const celuleCuCereri: Record<string, readonly AbsentaCelula[]> = { ...celule };
  for (const cerere of cereri) {
    if (!vizibili.has(cerere.employeeId)) continue;
    const tip = TIPURI.find((t) => t.id === cerere.tipId) ?? TIPURI[0];
    if (tip === undefined) continue;
    const sfarsit = laMiezulNoptiiUtc(cerere.panaLa);
    for (
      let zi = laMiezulNoptiiUtc(cerere.deLa);
      zi <= sfarsit;
      zi.setUTCDate(zi.getUTCDate() + 1)
    ) {
      const data = zi.toISOString().slice(0, 10);
      const cheie = cheieCelula(cerere.employeeId, data);
      celuleCuCereri[cheie] = [
        ...(celuleCuCereri[cheie] ?? []),
        { tipId: tip.id, tipDenumire: tip.denumire, tipCuloare: tip.culoare, stare: "in_aprobare" },
      ];
    }
  }

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
              // Vederea se schimbă odată cu rolul: o casetă rămasă deschisă
              // pentru un rol care abia și-a pierdut `leave:create` (manager)
              // ar fi arătat un formular fără niciun buton care s-o fi deschis.
              setCasetaDeschisa(false);
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

      {/*
        Doar rolurile cu `leave:create` văd butonul — seed-ul
        (`0002_authz.sql:1179`) NU dă managerului `create`, deci `poateCrea`
        întoarce `false` exact pentru el. Sursa rămâne `@/demo/roluri`, nu o
        presupunere de-aici.
      */}
      {poateCrea(rol) ? (
        <button
          type="button"
          onClick={() => {
            setCasetaDeschisa(true);
          }}
          className="rounded-panou text-corp bg-foreground text-background border px-3 py-1.5"
        >
          Cerere nouă
        </button>
      ) : null}

      {casetaDeschisa ? (
        <FormularCerereDemo
          angajatId={angajati[0]?.id ?? "d1"}
          primaZi={primaZi}
          ultimaZi={ultimaZi}
          laAdaugare={adauga}
        />
      ) : null}

      <PlanificatorConcedii zile={zile} angajati={angajati} celule={celuleCuCereri} azi={azi} />
    </div>
  );
}
