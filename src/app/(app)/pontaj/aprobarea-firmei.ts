// src/app/(app)/pontaj/aprobarea-firmei.ts
//
// Garda de server pentru firmele care au stins aprobarea pontajului (0118).
//
// ── DE CE NU AJUNGE SĂ ASCUNZI FILA ─────────────────────────────────────────
// `NavPontaj` nu mai desenează „Aprobare", iar dialogul zilei nu mai arată
// secțiunea de decizie. Amândouă sunt cosmetice: `/pontaj/aprobare` rămâne o
// rută validă pentru cine o tastează, un ecran rămas deschis de dinainte de
// schimbarea setării încă are butoanele randate, iar Server Actions sunt
// puncte de rețea — se pot chema fără niciun ecran.
//
// Regula asta NU se poate scrie ca politică RLS. Ar cere un subselect peste
// `setari_pontare_rapida` în `with check`, iar refuzul ar deveni atunci un
// UPDATE cu ZERO rânduri — adică tăcut (capcana 17). Aprobatorul ar apăsa
// „Aprobă" și n-ar afla niciodată de ce nu s-a întâmplat nimic.
//
// ── DE CE E UN REFUZ, NU O IGNORARE ─────────────────────────────────────────
// O aprobare care „nu se aplică" ar lăsa impresia că s-a aplicat. Mesajul spune
// unde se schimbă starea de lucruri, fiindcă singurul om care poate ajunge aici
// e unul cu `attendance:approve` — deci cineva care chiar caută butonul.

import { businessRule } from "@/lib/actions/errors";
import { setariPontareRapida } from "@/lib/queries/attendance";
import { configPontareRapida } from "@/domain/attendance/pontare-rapida";

/**
 * Oprește fluxul dacă firma a declarat că pontajul nu trece prin aprobare.
 *
 * Se cheamă la începutul fiecărei acțiuni de decizie — `aprobaPontajBloc`,
 * `decideZiPontaj`, `decideSaptamanaPontaj` — înaintea oricărei citiri sau
 * scrieri. Firma fără rând de setări cade pe implicitul „se cere aprobare"
 * (`IMPLICIT_PONTARE_RAPIDA`), deci nimic nu se schimbă pentru cine n-a
 * configurat nimic.
 */
export async function refuzaCandAprobareaEStinsa(organizationId: string): Promise<void> {
  const config = configPontareRapida(await setariPontareRapida(organizationId));
  if (!config.necesitaAprobare) {
    throw businessRule(
      "Firma a stabilit că pontajul nu trece prin aprobare, deci nu există nimic de decis. " +
        "Reporniți pasul de aprobare din Setări → Pontarea, dacă îl doriți înapoi.",
    );
  }
}
