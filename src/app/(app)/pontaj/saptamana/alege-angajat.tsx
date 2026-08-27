// src/app/(app)/pontaj/saptamana/alege-angajat.tsx
import { LATIMI } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";

interface OptiuneAngajat {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
}

/**
 * Pentru cine se completează săptămâna.
 *
 * ── DE CE UN `<form method="get">` ȘI NU O COMPONENTĂ CLIENT ────────────────
 * Alegerea trebuie să ajungă în URL: `?angajat=<id>&saptamana=<luni>`. Un URL
 * se pune la favorite, se trimite pe chat unui coleg și supraviețuiește lui
 * `router.refresh()` după salvare — ceea ce un `useState` nu face. Un formular
 * GET obișnuit produce exact asta, fără niciun kilobait de JavaScript și fără
 * `useTransition`, iar `<select>` nativ e singurul lucru care se comportă bine
 * pe telefon, unde ecranul ăsta se deschide cel mai des.
 *
 * `saptamana` călătorește ca `hidden`: fără el, schimbarea persoanei ar arunca
 * pe săptămâna implicită, iar cine compară două persoane pe aceeași săptămână
 * ar pierde locul la fiecare selecție.
 *
 * Butonul rămâne vizibil, nu se trimite `onChange`: pe un `<select>` nativ,
 * navigarea la simpla schimbare a valorii sare peste opțiuni la derularea cu
 * tastatura și e o capcană clasică de accesibilitate.
 */
export function AlegeAngajat({
  angajati,
  selectat,
  saptamanaStart,
}: {
  readonly angajati: readonly OptiuneAngajat[];
  /** Fișa afișată acum; `null` când cel care privește n-are fișă proprie. */
  readonly selectat: string | null;
  readonly saptamanaStart: string;
}) {
  return (
    <form
      method="get"
      className={`${LATIMI.formular} border-border rounded-panou flex flex-wrap items-end gap-3 border p-4`}
    >
      <input type="hidden" name="saptamana" value={saptamanaStart} />
      <div className="flex min-w-60 flex-1 flex-col gap-1">
        <label htmlFor="alege-angajat" className="text-corp">
          Planul cui
        </label>
        <select
          id="alege-angajat"
          name="angajat"
          defaultValue={selectat ?? ""}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          {selectat === null ? <option value="">— alegeți un angajat —</option> : null}
          {angajati.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name} ({a.marca})
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-nota">
          Aveți drept de pontaj peste toată firma, deci puteți deschide și completa săptămâna
          oricui.
        </p>
      </div>
      <button type="submit" className={buton({ varianta: "secundar" })}>
        Deschide
      </button>
    </form>
  );
}
