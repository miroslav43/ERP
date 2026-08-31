// src/lib/asistent/filtreaza.ts
/**
 * Taie din lista de destinații tot ce omul care întreabă nu poate deschide.
 *
 * Fără stratul ăsta, asistentul ar fi în cel mai bun caz enervant și în cel mai
 * rău caz o scurgere de informație: i-ar spune unui `employee` „intră în
 * Salarizare → Perioade și apasă Calculează", iar el ar primi
 * `AccesRestricționat`. A doua oară n-ar mai întreba. Și, chiar când ruta e
 * refuzată corect, simpla ei enumerare spune cine ce module are — o hartă a
 * firmei oferită gratuit oricui întreabă.
 *
 * Regula aplicată e IDENTICĂ, la nivel de expresie, cu cea din
 * `buildNavigation()`: modulul activ ȘI permisiunea peste prag. Nu e o copie —
 * ambele cheamă `meetsScope` din `@/config/permissions`, singura implementare a
 * pragului. O a doua regulă, scrisă independent aici, ar fi divergat de meniu
 * la prima ajustare de scope, iar asistentul ar fi început să ofere exact ce
 * sidebar-ul ascunde.
 *
 * Ascunderea de aici NU e barieră de securitate, la fel ca ascunderea din
 * meniu: pagina verifică din nou, acțiunea verifică din nou, iar RLS respinge
 * rândul chiar dacă primele trei sunt ocolite. E o barieră de UTILITATE și de
 * discreție.
 */
import type { FeatureKey } from "@/config/features";
import { meetsScope } from "@/config/permissions";
// Tip pur, șters la compilare: `import type` nu trage după el `server-only`,
// deci fișierul rămâne importabil din testul de nod și din prompt.
import type { PermissionMap } from "@/lib/auth/permissions";

import { DESTINATII, type Destinatie, type ZonaAsistent } from "./destinatii";

export type ContextAcces = Readonly<{
  features: ReadonlySet<FeatureKey>;
  permisiuni: PermissionMap;
  zona: ZonaAsistent;
}>;

/**
 * Poate omul ăsta deschide destinația asta?
 *
 * `permisiuni.get(cheie)` întoarce `undefined` și pentru „nu are cheia", și
 * pentru „o are pe `none`" — `getPermissionMap` filtrează deja `none` din hartă,
 * fiindcă `none` e refuz explicit, nu absență. `meetsScope(undefined, …)` le
 * tratează pe amândouă ca refuz, ceea ce e corect: aici cele două chiar nu
 * diferă. (Diferă în ALT loc — o poartă scrisă `scope === "none"` lasă să treacă
 * absența; de aceea nicăieri în fișierul ăsta nu se compară direct cu `"none"`.)
 */
export function poateAjunge(destinatie: Destinatie, context: ContextAcces): boolean {
  if (destinatie.zona !== context.zona) return false;
  if (destinatie.featureKey !== null && !context.features.has(destinatie.featureKey)) return false;
  if (destinatie.permission === null) return true;
  return meetsScope(context.permisiuni.get(destinatie.permission), destinatie.minScope);
}

/** Destinațiile pe care le poate deschide, în ordinea din index. */
export function destinatiiPermise(context: ContextAcces): readonly Destinatie[] {
  return DESTINATII.filter((destinatie) => poateAjunge(destinatie, context));
}
