// src/domain/departments/manager-membru.ts
/**
 * Regula care leagă „cine conduce" de „cine e membru".
 *
 * ── DE CE E NEVOIE DE EA ──────────────────────────────────────────────────
 * Schema ține două coloane care descriu lucruri diferite și n-au nicio punte
 * între ele:
 *
 *   `departments.manager_employee_id` — cine CONDUCE departamentul
 *   `employees.department_id`         — cine e MEMBRU în el
 *
 * Ecranul de structură le citește din surse separate: managerul din embed-ul
 * `manager:employees!manager_employee_id(...)`, iar lista de persoane și pastila
 * de efectiv EXCLUSIV din `employees.department_id`. Până acum, desemnarea unui
 * manager scria doar prima coloană — deci omul apărea pe card ca manager și
 * lipsea din lista departamentului pe care tocmai i-l dăduseși. Nicio eroare,
 * niciun avertisment: exact felul de defect pe care proiectul îl numește „refuz
 * tăcut", numai că aici nu refuză nimeni nimic, pur și simplu nu se scrie.
 *
 * ── DE CE NU „mută întotdeauna" ───────────────────────────────────────────
 * Ar fi fost o linie de cod în loc de fișierul ăsta. Dar un manager luat dintr-un
 * alt departament ar fi PLECAT tăcut din el: efectivul vechi ar fi scăzut cu
 * unu, fără ca cineva să fi cerut asta, la o salvare care în intenția omului
 * schimba doar denumirea sau centrul de cost. Mutarea între departamente are un
 * ecran al ei, cu confirmare (`mutaAngajati`); nu se face din reflex.
 *
 * Deci: nerepartizat ⇒ se repartizează tăcut, fiindcă nu se pierde nimic.
 * Repartizat altundeva ⇒ numai dacă omul a bifat, după ce a văzut UNDE e acum.
 *
 * ── DE CE E FUNCȚIE PURĂ, NU UN `if` ÎN HANDLER ───────────────────────────
 * Aceeași decizie e nevoie în DOUĂ acțiuni — creare și actualizare — iar a doua
 * copie e locul unde regulile se despart tăcut. Aici e testată o singură dată,
 * fără Supabase și fără React.
 */

export type MotivInactiune =
  /** Câmpul „Manager" a rămas pe „— nedesemnat —". */
  | "fara_manager"
  /** Managerul e deja în departament: nu e nimic de scris. */
  | "deja_membru"
  /**
   * Departamentul e dezactivat, deci NU primește oameni.
   *
   * `dezactiveazaDepartament` refuză închiderea până când departamentul e gol,
   * dar NU golește `manager_employee_id` — un departament dezactivat poate
   * rămâne deci cu un manager desemnat. Fără ramura asta, o simplă redenumire a
   * lui l-ar repopula pe la spate cu exact o persoană, contrazicând regula pe
   * care `mutaAngajati` o apără explicit.
   */
  | "departament_inactiv"
  /** E în alt departament, iar bifa de mutare e stinsă. Stare legitimă. */
  | "mutare_refuzata";

export type DecizieManager =
  | Readonly<{ fel: "nimic"; motiv: MotivInactiune }>
  | Readonly<{
      fel: "repartizeaza";
      employeeId: string;
      /** `true` ⇒ omul PLEACĂ dintr-un departament, deci mesajele o spun. */
      dinAltDepartament: boolean;
    }>;

export interface IntrareDecizieManager {
  /** Managerul ALES acum. `null` = „— nedesemnat —". */
  readonly managerId: string | null;
  /** Departamentul căruia i se desemnează managerul. */
  readonly departamentId: string;
  /**
   * `employees.department_id` al managerului ales, citit ÎNAINTE de scriere.
   *
   * Atenție: un id pe care apelantul nu-l vede prin RLS e tot un id, nu `null`.
   * Tratarea lui drept „nerepartizat" ar muta pe cineva dintr-un departament
   * despre care nici măcar nu i se poate spune că există.
   */
  readonly departamentulManagerului: string | null;
  /** `departments.activ`. Un departament închis nu primește oameni. */
  readonly departamentActiv: boolean;
  /** Bifa din formular: „Mută-l în acest departament la salvare". */
  readonly mutaDinAltDepartament: boolean;
}

export function decideApartenentaManagerului(intrare: IntrareDecizieManager): DecizieManager {
  const {
    managerId,
    departamentId,
    departamentulManagerului,
    departamentActiv,
    mutaDinAltDepartament,
  } = intrare;

  if (managerId === null) return { fel: "nimic", motiv: "fara_manager" };
  if (departamentulManagerului === departamentId) return { fel: "nimic", motiv: "deja_membru" };
  // După „deja_membru", nu înainte: un manager care E deja acolo nu se mișcă
  // nicăieri, deci nu are ce încălca regula departamentului închis.
  if (!departamentActiv) return { fel: "nimic", motiv: "departament_inactiv" };

  if (departamentulManagerului === null) {
    return { fel: "repartizeaza", employeeId: managerId, dinAltDepartament: false };
  }

  return mutaDinAltDepartament
    ? { fel: "repartizeaza", employeeId: managerId, dinAltDepartament: true }
    : { fel: "nimic", motiv: "mutare_refuzata" };
}
