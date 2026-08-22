// src/domain/payroll/etape/probleme.ts
//
// Forma pe care o etapă de calcul o folosește ca să semnaleze ceva
// orchestratorului.
//
// Codul e un ȘIR, nu o valoare din uniunea `CodProblema` a catalogului, și asta
// e deliberat: etapele rămân module pure, independente între ele, iar o uniune
// literală comună le-ar lega pe toate de același fișier — orice etapă nouă ar
// cere o modificare acolo, adică exact punctul de coliziune pe care structura
// asta îl evită.
//
// Traducerea în catalogul din `../erori.ts` — cu severitate, cauză și mod de
// reparare — o face orchestratorul, într-un singur loc.

export interface ProblemaEtapa {
  /** Cod stabil, de forma `SAL_*`. Se mapează în catalog de orchestrator. */
  readonly cod: string;
  /** Cifrele cazului: sume, zile, luni, serii de certificat. */
  readonly detalii: string;
}
