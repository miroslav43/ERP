// src/domain/departments/rol-sef.ts
/**
 * Regula care leagă „cine conduce un departament" de „ce rol are în aplicație".
 *
 * ── DE CE E NEVOIE DE EA ──────────────────────────────────────────────────
 * Structura și drepturile trăiau complet separat: puteai fi șef la Producție cu
 * rolul `employee` și nu vedeai nici pontajul oamenilor tăi, nici cererile lor
 * de concediu. Singura cale de a repara era `/setari/membri`, un ecran despre
 * care omul care tocmai desemnase șeful n-avea de unde să știe.
 *
 * ── DE CE NU SCRIE ORICINE ────────────────────────────────────────────────
 * `hr` are `departments:update = all`, deci POATE desemna un șef. Dar politica
 * de pe `organization_members` (0002_authz.sql:959) cere
 * `app.has_role(org, ['org_admin'])` — ROL, nu permisiune. O suprascriere de
 * `roles:update` nu ajută. Deci pentru oricine nu e administrator, scrierea ar
 * pleca spre bază și s-ar întoarce ca UPDATE cu ZERO RÂNDURI ȘI FĂRĂ EROARE.
 *
 * Ramura `autor_fara_drept` există ca să nu se ajungă acolo: decizia spune „nu
 * scriu, și iată de ce", iar ecranul traduce în „cere unui administrator".
 * Alternativa — o funcție `security definer` care scrie oricum — s-a respins:
 * ar fi însemnat că HR-ul, care n-are niciun `users:*`, poate fabrica manageri
 * făcând pe cineva șef de departament.
 *
 * ── CE NU ATINGE NICIODATĂ ────────────────────────────────────────────────
 * `org_admin` și `hr`. Automatul trăiește exclusiv între `employee` și
 * `manager`, deci un om pus manual pe `hr` din pagina lui de permisiuni rămâne
 * `hr` chiar dacă mâine conduce un departament. Regula e o condiție, nu o stare
 * ținută în baza de date — nu există nicio coloană „rol setat manual".
 */

/**
 * Rolurile așa cum le poate întoarce baza — enumul `public.app_role` întreg.
 *
 * `super_admin` e inclus deși politica îl interzice pe `organization_members`
 * (`role <> 'super_admin'`, la INSERT și la UPDATE): tipul generat îl conține,
 * iar o îngustare la graniță ar fi cerut o conversie care minte. Aici e mai
 * simplu decât pare — cade în aceeași ramură ca `org_admin`: nu se atinge.
 */
export type RolMembru = "super_admin" | "org_admin" | "manager" | "hr" | "employee";

/**
 * Șeful, în cele trei stări care au consecințe diferite.
 *
 * `fara_cont` NU e același lucru cu `nedesemnat`, deși ambele ar fi fost `null`
 * într-o modelare leneșă: primul e un om real căruia nu ai ce rol să-i dai (5
 * din 12 fișe active n-aveau `user_id` pe 29 aug 2026), al doilea e un câmp
 * lăsat gol. Confundate, „n-are cont" ar dispărea tăcut în „n-a ales nimeni".
 */
export type Sef =
  | Readonly<{ fel: "nedesemnat" }>
  | Readonly<{ fel: "fara_cont" }>
  | Readonly<{ fel: "membru"; memberId: string; rol: RolMembru }>;

export type MotivRol =
  /** Salvarea n-a schimbat șeful — o redenumire nu rescrie roluri. */
  | "sef_neschimbat"
  /** Autorul nu e `org_admin`: baza ar refuza tăcut. Se arată, nu se încearcă. */
  | "autor_fara_drept"
  /** Câmpul „Manager" e pe „— nedesemnat —". */
  | "fara_persoana"
  /** Fișa există, contul nu. Rolul se acordă unei apartenențe, nu unei fișe. */
  | "fara_cont"
  /** `org_admin` sau `hr`: automatul nu-i atinge niciodată. */
  | "rol_protejat"
  /** Are deja rolul pe care i l-ar da regula. */
  | "deja_potrivit"
  /** Fostul șef mai conduce alt departament activ. */
  | "mai_conduce"
  /** Aceeași persoană și înainte, și după: nu e o înlocuire. */
  | "acelasi_om";

export type ActiuneRol =
  | Readonly<{ fel: "scrie"; memberId: string; rol: "manager" | "employee" }>
  | Readonly<{ fel: "nimic"; motiv: MotivRol }>;

export type DecizieRolSef = Readonly<{
  /** Ce se face cu omul desemnat acum. */
  promovare: ActiuneRol;
  /** Ce se face cu cel pe care tocmai l-a înlocuit. */
  retrogradare: ActiuneRol;
}>;

export interface IntrareDecizieRolSef {
  /** `ctx.tenant.role === "org_admin"`. Singurul care poate scrie roluri. */
  readonly autorEsteAdministrator: boolean;
  /** `manager_employee_id` de dinainte diferă de cel de acum. */
  readonly sefSchimbat: boolean;
  readonly sefNou: Sef;
  readonly sefAnterior: Sef;
  /** Fostul șef mai apare ca `manager_employee_id` pe alt departament activ. */
  readonly anteriorMaiConduce: boolean;
}

const nimic = (motiv: MotivRol): ActiuneRol => ({ fel: "nimic", motiv });

export function decideRolulSefului(intrare: IntrareDecizieRolSef): DecizieRolSef {
  const { autorEsteAdministrator, sefSchimbat, sefNou, sefAnterior, anteriorMaiConduce } = intrare;

  // Ordinea celor două porți contează. „Neschimbat" trece înaintea drepturilor
  // fiindcă o salvare care nu atinge șeful nu e o încercare de a scrie roluri:
  // altfel HR-ul ar primi „cere unui administrator" de fiecare dată când
  // corectează o denumire.
  if (!sefSchimbat) {
    const motiv = nimic("sef_neschimbat");
    return { promovare: motiv, retrogradare: motiv };
  }
  if (!autorEsteAdministrator) {
    const motiv = nimic("autor_fara_drept");
    return { promovare: motiv, retrogradare: motiv };
  }

  // Aceeași apartenență de ambele părți: fișa desemnată s-a schimbat, dar omul
  // din spatele ei nu. Fără verificarea asta l-am retrograda pe cel pe care
  // tocmai l-am promovat, în aceeași salvare.
  const acelasiOm =
    sefNou.fel === "membru" &&
    sefAnterior.fel === "membru" &&
    sefNou.memberId === sefAnterior.memberId;

  return {
    promovare: decidePromovarea(sefNou),
    retrogradare: acelasiOm
      ? nimic("acelasi_om")
      : decideRetrogradarea(sefAnterior, anteriorMaiConduce),
  };
}

function decidePromovarea(sef: Sef): ActiuneRol {
  if (sef.fel === "nedesemnat") return nimic("fara_persoana");
  if (sef.fel === "fara_cont") return nimic("fara_cont");
  if (sef.rol === "manager") return nimic("deja_potrivit");
  if (sef.rol !== "employee") return nimic("rol_protejat");
  return { fel: "scrie", memberId: sef.memberId, rol: "manager" };
}

function decideRetrogradarea(sef: Sef, maiConduce: boolean): ActiuneRol {
  if (sef.fel === "nedesemnat") return nimic("fara_persoana");
  if (sef.fel === "fara_cont") return nimic("fara_cont");
  if (sef.rol === "employee") return nimic("deja_potrivit");
  // Orice NU e `manager` e protejat — `org_admin`, `hr` și, teoretic,
  // `super_admin`. Se verifică ÎNAINTEA lui `mai_conduce`: patronul care cedează
  // departamentul nu trebuie retrogradat nici măcar dacă nu mai conduce nimic.
  if (sef.rol !== "manager") return nimic("rol_protejat");
  if (maiConduce) return nimic("mai_conduce");
  return { fel: "scrie", memberId: sef.memberId, rol: "employee" };
}
