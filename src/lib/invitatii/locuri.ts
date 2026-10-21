// src/lib/invitatii/locuri.ts
//
// Locurile din contract: câte sunt folosite și dacă s-a atins plafonul.
//
// Un singur loc pentru aritmetică (ONB-027): `creeazaInvitatie` refuză după ea,
// iar ecranul de membri afișează după ea. Două copii ar fi putut număra diferit —
// ecranul ar fi spus „4 locuri libere", iar refuzul ar fi venit la a patra
// invitație. Fără `server-only`: se importă și din componenta client.

export type Locuri = Readonly<{
  /** Membri activi + invitații în așteptare: o invitație ține locul rezervat. */
  folosite: number;
  /** `null` = contract fără plafon. */
  limita: number | null;
  /** Câte mai încap; niciodată sub zero. `null` când nu există plafon. */
  ramase: number | null;
  /** O invitație NOUĂ ar fi refuzată. */
  plin: boolean;
}>;

export function numaraLocuri(
  p: Readonly<{ membriActivi: number; invitatiiPendinte: number; limita: number | null }>,
): Locuri {
  const folosite = p.membriActivi + p.invitatiiPendinte;
  if (p.limita === null) {
    return { folosite, limita: null, ramase: null, plin: false };
  }
  return {
    folosite,
    limita: p.limita,
    ramase: Math.max(0, p.limita - folosite),
    plin: folosite >= p.limita,
  };
}
