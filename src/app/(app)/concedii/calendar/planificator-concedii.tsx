// src/app/(app)/concedii/calendar/planificator-concedii.tsx
//
// Planificatorul: un rând per angajat, o coloană per zi a lunii.
//
// ── DE CE ÎNCĂ O VEDERE ───────────────────────────────────────────────────
// Grila lunară adună absențele în ziua lor și răspunde bine la „cine lipsește
// pe 9 martie". Nu răspunde deloc la cealaltă întrebare, cea pe care o pune
// oricine face un grafic: „se suprapun Ionescu și Popa, și cine îmi rămâne în
// săptămâna 12". Pentru asta oamenii trebuie să vadă rândurile alături, nu
// zilele una sub alta.
//
// ── CULOAREA E TIPUL, FORMA E STAREA ──────────────────────────────────────
// Culoarea vine din `leave_types.culoare` — un hex ales de administrator dintr-un
// `<input type="color">` fără nicio constrângere. Ea poartă TIPUL de concediu.
// Starea („aprobată" / „în aprobare") NU se poate purta prin a doua culoare
// derivată din prima: nu există transformare care să dea un rezultat previzibil
// pe orice hex, iar `opacity` e interzisă în produs exact din motivul ăsta
// (v. comentariul din `grila-calendar.tsx`). O poartă hașura, care se vede pe
// orice fundal, la orice culoare, și supraviețuiește unei imprimante alb-negru.
//
// Casetele nu conțin text, deci nu se pune problema contrastului cerneală/fundal
// din `@/domain/leave/contrast` — dar au nevoie de un contur ca să nu dispară
// culorile deschise pe crem, iar conturul e din token, nu derivat din culoare.
import type { CSSProperties } from "react";

import {
  alegeAbsenta,
  descriereCelula,
  legendaPlanificatorului,
  numeZiSaptamana,
  cheieCelula,
  INITIALE_ZILE,
  type AbsentaCelula,
  type StareAbsenta,
  type ZiPlanificator,
} from "@/domain/leave/planificator";

export interface RandAngajatPlanificator {
  readonly id: string;
  readonly nume: string;
  readonly marca: string;
}

interface Proprietati {
  readonly zile: readonly ZiPlanificator[];
  readonly angajati: readonly RandAngajatPlanificator[];
  /** Cheia e `cheieCelula(employeeId, iso)`; serializabil peste granița server/client. */
  readonly celule: Readonly<Record<string, readonly AbsentaCelula[]>>;
  /** Ziua curentă în `Europe/Bucharest`, ca să se marcheze coloana de azi. */
  readonly azi: string;
}

function stilCaseta(culoare: string, stare: StareAbsenta): CSSProperties {
  if (stare === "aprobata") return { backgroundColor: culoare };
  // Hașură de 45°, dungi de 3px cu 3px pauză: destul de deasă ca să se
  // citească într-o casetă de 20px și destul de rară ca să rămână evident că
  // NU e umplere plină.
  return {
    backgroundImage: `repeating-linear-gradient(45deg, ${culoare} 0 3px, transparent 3px 6px)`,
  };
}

/** Pastila de legendă — aceeași funcție de stil ca în grilă, ca să nu se despartă. */
function SemnLegenda({
  culoare,
  stare,
}: {
  readonly culoare: string;
  readonly stare: StareAbsenta;
}) {
  return (
    <span
      aria-hidden="true"
      className={`border-foreground/20 inline-block h-3 w-5 shrink-0 rounded-[2px] border ${
        stare === "aprobata" ? "" : "bg-background"
      }`}
      style={stilCaseta(culoare, stare)}
    />
  );
}

export function PlanificatorConcedii({ zile, angajati, celule, azi }: Proprietati) {
  const legenda = legendaPlanificatorului(celule);
  const areAbsente = Object.keys(celule).length > 0;

  if (angajati.length === 0) {
    return (
      <p className="border-foreground/60 text-muted-foreground rounded-panou text-corp border border-dashed p-4 text-center">
        Nu aveți niciun angajat vizibil în luna aceasta, deci planificatorul nu are rânduri.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {!areAbsente ? (
        <p className="border-foreground/60 text-muted-foreground rounded-panou text-corp border border-dashed p-4 text-center">
          Nicio absență de echipă înregistrată în această lună. Rândurile de mai jos arată cine e
          disponibil.
        </p>
      ) : null}

      {/*
        `relative` NU e decor, și nu se poate scoate.

        Fiecare celulă poartă un `<span class="sr-only">` — poziționat ABSOLUT,
        de 1×1 px. Un element absolut e clipuit de un container cu `overflow`
        doar dacă blocul lui conținător e chiar containerul ori un descendent al
        lui. Fără `relative` aici, blocul conținător devine cel inițial, deci
        cele ~120 de pastile invizibile își păstrează poziția statică din
        interiorul tabelului — la 670 px — și ÎNTIND zona derulabilă a
        documentului. Măsurat pe telefon (390 px): pagina întreagă se târa 296
        px lateral, cu tot cu meniu și antet, deși tabelul avea propriul derulaj.
        Cu `relative`, `documentElement.scrollWidth` scade de la 686 la 390.
      */}
      <div className="border-border rounded-panou relative overflow-x-auto border">
        {/*
          Lățimea minimă e CALCULATĂ, nu aleasă: coloana de nume plus o coloană
          de 2rem pentru fiecare zi a lunii afișate. Februarie are 28, martie
          31 — o constantă ar fi fost greșită într-una dintre ele.

          Fără ea, `min-w-8` de pe celule nu ajunge: algoritmul automat de tabel
          strânge coloanele ca să încapă în container, iar pe telefon ajungeau
          la 19 px. Minimul e pe TABEL, singurul loc pe care algoritmul îl
          respectă necondiționat; containerul de deasupra derulează.
        */}
        <table
          className="border-separate border-spacing-0"
          style={{ minWidth: `calc(11rem + ${String(zile.length)} * 2rem)` }}
        >
          <caption className="sr-only">
            Planificatorul lunar al concediilor: câte un rând pentru fiecare angajat și câte o
            coloană pentru fiecare zi a lunii.
          </caption>
          <thead>
            <tr>
              {/*
                Coloana de nume rămâne pe loc la derularea orizontală — cu 31 de
                coloane, o grilă în care numele iese din ecran nu se mai poate
                citi deloc. `z-30` o ține peste antetul zilelor, care e la `z-20`.
              */}
              <th
                scope="col"
                className="border-border bg-surface text-muted-foreground text-nota sticky left-0 z-30 min-w-44 border-r border-b px-2 py-1.5 text-left font-medium"
              >
                Angajat
              </th>
              {zile.map((zi) => {
                const esteAzi = zi.iso === azi;
                return (
                  <th
                    key={zi.iso}
                    scope="col"
                    // `min-w-8`, nu doar `w-8`: fără un MINIM, algoritmul de
                    // tabel strânge coloanele ca să încapă în container, iar pe
                    // telefon ele ajungeau la 19 px — cifra zilei se lipea de
                    // chenar și caseta de culoare devenea un fir. Cu minimul,
                    // tabelul își păstrează lățimea firească și derulează.
                    className={`border-border text-nota w-8 min-w-8 border-r border-b px-0 py-1 text-center font-medium ${
                      esteAzi
                        ? "bg-primary text-primary-foreground"
                        : zi.nelucratoare
                          ? "bg-surface text-muted-foreground"
                          : "bg-surface text-foreground"
                    }`}
                  >
                    <span className="block leading-tight">{INITIALE_ZILE[zi.dowIso - 1]}</span>
                    <span className="block leading-tight font-semibold">{zi.zi}</span>
                    {/* Antetul îngust arată „Ma 10”; cititorul de ecran primește
                        ziua întreagă, altfel coloana n-are niciun nume util. */}
                    <span className="sr-only">
                      {numeZiSaptamana(zi.dowIso)} {zi.zi}
                      {esteAzi ? " (azi)" : ""}
                      {zi.nelucratoare ? " (zi nelucrătoare)" : ""}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {angajati.map((angajat) => (
              <tr key={angajat.id}>
                <th
                  scope="row"
                  className="border-border bg-background text-corp sticky left-0 z-20 min-w-44 border-r border-b px-2 py-1 text-left font-normal"
                >
                  <span className="block truncate">{angajat.nume}</span>
                  <span className="text-muted-foreground text-nota block">{angajat.marca}</span>
                </th>
                {zile.map((zi) => {
                  const absente = celule[cheieCelula(angajat.id, zi.iso)] ?? [];
                  const absenta = alegeAbsenta(absente);
                  if (absenta === null) {
                    return (
                      <td
                        key={zi.iso}
                        className={`border-border border-r border-b ${zi.nelucratoare ? "bg-surface" : ""}`}
                      />
                    );
                  }
                  const descriere = descriereCelula(
                    angajat.nume,
                    zi.iso,
                    absenta,
                    absente.length - 1,
                  );
                  return (
                    <td
                      key={zi.iso}
                      title={descriere}
                      className={`border-border border-r border-b p-0.5 ${zi.nelucratoare ? "bg-surface" : ""}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`border-foreground/20 block h-5 w-full rounded-[2px] border ${
                          absenta.stare === "aprobata" ? "" : "bg-background"
                        }`}
                        style={stilCaseta(absenta.tipCuloare, absenta.stare)}
                      />
                      {/* `title` nu apare la atingere și nu se citește la
                          tastatură: pe telefon tipul și starea ar fi
                          inaccesibile. Aceeași lecție ca în grila lunară. */}
                      <span className="sr-only">{descriere}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {legenda.length === 0 ? null : (
        <div className="text-muted-foreground text-nota flex flex-wrap items-center gap-x-4 gap-y-2">
          {legenda.map((tip) => (
            <span key={tip.tipDenumire} className="flex items-center gap-1.5">
              <SemnLegenda culoare={tip.tipCuloare} stare="aprobata" />
              {tip.tipDenumire}
            </span>
          ))}
          {/* Starea, explicată o singură dată pentru toate tipurile: hașura
              înseamnă același lucru pe orice culoare, deci un rând per tip ar
              fi dublat legenda fără să adauge nimic. Culoarea aleasă pentru
              exemplu e a primului tip de pe ecran, ca semnul să fie recunoscut. */}
          <span className="flex items-center gap-1.5">
            <SemnLegenda culoare={legenda[0]?.tipCuloare ?? "#14213d"} stare="in_aprobare" />
            hașurat = cerere încă neaprobată
          </span>
        </div>
      )}
    </div>
  );
}
