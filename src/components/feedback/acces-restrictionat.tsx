import { Lock } from "lucide-react";

/**
 * Ecranul afișat când utilizatorul e autentificat și membru, dar nu are dreptul
 * pe această pagină.
 *
 * Distinct de 404, deliberat. Un modul DEZACTIVAT pentru organizație întoarce
 * 404: nu confirmăm ce module există sau ce nu a contractat clientul. O
 * permisiune lipsă în interiorul unui modul activ este altceva — colegii
 * utilizatorului chiar folosesc pagina, iar un 404 l-ar trimite să caute un bug
 * inexistent în loc să ceară dreptul de la administratorul lui.
 *
 * Ascunderea aceasta NU este bariera de securitate. Acțiunile refuză separat
 * prin `createAction`, iar RLS respinge rândurile chiar dacă cineva ajunge aici.
 */
export function AccesRestrictionat({
  titlu = "Acces restricționat",
  mesaj,
}: {
  titlu?: string;
  mesaj: string;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <div className="border-border bg-surface rounded-lg border p-8 text-center">
        <Lock aria-hidden="true" className="text-warning mx-auto size-6" />
        <h1 className="text-foreground mt-3 text-lg font-semibold">{titlu}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{mesaj}</p>
      </div>
    </main>
  );
}
