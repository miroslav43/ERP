// src/lib/departamente/sef.ts
// Latura de bază a regulii „șef de departament ⇒ rol de manager".
//
// Deciziile stau în `@/domain/departments/rol-sef` și
// `@/domain/departments/subordonare-sef`, unde sunt pure și testate. Aici e doar
// ce nu se poate testa fără Postgres: citirile de care au nevoie și scrierile
// care urmează, în ORDINEA impusă de triggere.
//
// Modul separat, nu încă 150 de linii în `departamente/actions.ts`: fișierul are
// deja 455 și trei acțiuni care ar folosi aceleași ajutoare.
import { businessRule, mapPostgrestError } from "@/lib/actions/errors";
import type { ServerSupabase } from "@/lib/supabase/server";
import { decideRolulSefului, type DecizieRolSef, type Sef } from "@/domain/departments/rol-sef";
import { planificaEliberarea, planificaSubordonarea } from "@/domain/departments/subordonare-sef";
import { schimbaRolul } from "@/lib/membri/schimba-rol";

export type ContextSef = Readonly<{
  db: ServerSupabase;
  organizationId: string;
  requestId: string;
  /** `employees.updated_by` pe fișele atinse. */
  userId: string;
  /** Apartenența autorului — nimeni nu-și schimbă singur rolul. */
  memberIdAutor: string | null;
  /**
   * `ctx.tenant.role === "org_admin"`.
   *
   * Singurul care poate scrie roluri: `organization_members_update` cere
   * `app.has_role(org, ['org_admin'])`. Pentru oricine altcineva — `hr`, care
   * ARE `departments:update = all` — scrierea s-ar întoarce ca UPDATE cu zero
   * rânduri și fără eroare, deci nici nu se încearcă.
   */
  autorEsteAdministrator: boolean;
}>;

/**
 * Apartenența din spatele unei fișe, în forma pe care o cere decizia.
 *
 * `fara_cont` acoperă trei situații cu același efect — fișa n-are `user_id`,
 * apartenența lipsește, sau fișa a fost ștearsă între timp: în toate, nu există
 * un rând `organization_members` pe care să scrii un rol.
 */
export async function citesteSeful(ctx: ContextSef, employeeId: string | null): Promise<Sef> {
  if (employeeId === null) return { fel: "nedesemnat" };

  const fisa = await ctx.db
    .from("employees")
    .select("user_id")
    .eq("id", employeeId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (fisa.error !== null) throw mapPostgrestError(fisa.error, ctx.requestId);
  // Întrebarea nu se PUNE dacă `user_id` e NULL: `.eq("user_id", "")` trimite
  // șirul vid unei coloane `uuid` și ridică 22P02, nu „nicio potrivire".
  if (fisa.data === null || fisa.data.user_id === null) return { fel: "fara_cont" };

  const membru = await ctx.db
    .from("organization_members")
    .select("id, role")
    .eq("organization_id", ctx.organizationId)
    .eq("user_id", fisa.data.user_id)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();
  if (membru.error !== null) throw mapPostgrestError(membru.error, ctx.requestId);
  if (membru.data === null) return { fel: "fara_cont" };

  return { fel: "membru", memberId: membru.data.id, rol: membru.data.role };
}

/** Mai conduce vreun departament ACTIV, în afară de cel pe care tocmai l-a pierdut? */
export async function maiConduceAltDepartament(
  ctx: ContextSef,
  employeeId: string,
  exceptaDepartamentul: string,
): Promise<boolean> {
  const { count, error } = await ctx.db
    .from("departments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.organizationId)
    .eq("manager_employee_id", employeeId)
    .eq("activ", true)
    .is("deleted_at", null)
    .neq("id", exceptaDepartamentul);
  if (error !== null) throw mapPostgrestError(error, ctx.requestId);
  return (count ?? 0) > 0;
}

/**
 * Decizia completă pentru o schimbare de șef, cu toate citirile ei.
 *
 * `sefAnteriorId` se citește de pe departament ÎNAINTE de UPDATE: după, coloana
 * are deja valoarea nouă, iar cine a fost înainte nu s-ar mai afla decât din
 * jurnal.
 */
export async function decideSchimbareaSefului(
  ctx: ContextSef,
  parametri: Readonly<{
    sefAnteriorId: string | null;
    sefNouId: string | null;
    departamentId: string;
  }>,
): Promise<DecizieRolSef> {
  const { sefAnteriorId, sefNouId, departamentId } = parametri;
  const sefSchimbat = sefAnteriorId !== sefNouId;

  // Nicio citire dacă nu e nimic de decis: o redenumire de departament nu
  // trebuie să coste patru interogări.
  if (!sefSchimbat || !ctx.autorEsteAdministrator) {
    return decideRolulSefului({
      autorEsteAdministrator: ctx.autorEsteAdministrator,
      sefSchimbat,
      sefNou: { fel: "nedesemnat" },
      sefAnterior: { fel: "nedesemnat" },
      anteriorMaiConduce: false,
    });
  }

  const [sefNou, sefAnterior] = await Promise.all([
    citesteSeful(ctx, sefNouId),
    citesteSeful(ctx, sefAnteriorId),
  ]);

  return decideRolulSefului({
    autorEsteAdministrator: true,
    sefSchimbat,
    sefNou,
    sefAnterior,
    anteriorMaiConduce:
      sefAnteriorId === null
        ? false
        : await maiConduceAltDepartament(ctx, sefAnteriorId, departamentId),
  });
}

/**
 * Scrie rolurile decise. Promovarea înaintea retrogradării, deliberat.
 *
 * La înlocuirea unui șef, ordinea inversă ar lăsa o clipă firma fără managerul
 * respectiv — irelevant pentru date, dar nu și pentru piedica „organizația
 * trebuie să aibă cel puțin un administrator activ", care numără rânduri reale.
 */
export async function aplicaRolurile(
  ctx: ContextSef,
  decizie: DecizieRolSef,
  ceEsteDejaScris: string,
): Promise<void> {
  for (const actiune of [decizie.promovare, decizie.retrogradare]) {
    if (actiune.fel !== "scrie") continue;
    await schimbaRolul({
      db: ctx.db,
      organizationId: ctx.organizationId,
      memberId: actiune.memberId,
      rol: actiune.rol,
      memberIdAutor: ctx.memberIdAutor,
      ceEsteDejaScris,
    });
  }
}

/**
 * Trece departamentul în subordinea noului șef.
 *
 * Ordinea NU e negociabilă: `tg_employees_manager_path` aruncă `P0001` la ciclu
 * și anulează tot lotul, iar șeful e adesea subordonat cuiva din propriul
 * departament. Întâi se ridică el din lanț, abia apoi se leagă oamenii de el.
 */
export async function aplicaSubordonarea(
  ctx: ContextSef,
  parametri: Readonly<{
    departamentId: string;
    sefId: string;
    sefAnteriorId: string | null;
    caleaDepartamentului: readonly string[];
  }>,
  ceEsteDejaScris: string,
): Promise<void> {
  const { departamentId, sefId, sefAnteriorId, caleaDepartamentului } = parametri;

  const [membri, fisaSefului, deDeasupra] = await Promise.all([
    citesteMembrii(ctx, departamentId),
    ctx.db
      .from("employees")
      .select("manager_path, manager_employee_id")
      .eq("id", sefId)
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null)
      .maybeSingle(),
    citesteSefulDeDeasupra(ctx, departamentId, caleaDepartamentului),
  ]);
  if (fisaSefului.error !== null) throw mapPostgrestError(fisaSefului.error, ctx.requestId);

  const plan = planificaSubordonarea({
    sefId,
    membri,
    caleaSefului: fisaSefului.data?.manager_path ?? [sefId],
    sefulDeDeasupra: deDeasupra.id,
    caleaSefuluiDeDeasupra: deDeasupra.cale,
    sefAnteriorId,
    managerDirectAlSefului: fisaSefului.data?.manager_employee_id ?? null,
  });

  if (plan.ridicaSeful !== null) {
    await scrieManagerul(ctx, [sefId], plan.ridicaSeful.nouManager, ceEsteDejaScris);
  }
  if (plan.deLegat.length > 0) {
    await scrieManagerul(ctx, plan.deLegat, sefId, ceEsteDejaScris);
  }
}

/**
 * Oglinda: departamentul rămâne fără șef, oamenii ies din subordinea lui.
 *
 * Fără ea, ștergerea managerului lăsa subordonarea scrisă de desemnarea lui
 * intactă, iar singurul drum înapoi era câmpul „Manager direct" de pe fișa
 * fiecărui om — vezi cronologia din `@/domain/departments/subordonare-sef`.
 */
export async function elibereazaSubordonarea(
  ctx: ContextSef,
  parametri: Readonly<{
    departamentId: string;
    sefAnteriorId: string;
    caleaDepartamentului: readonly string[];
  }>,
  ceEsteDejaScris: string,
): Promise<void> {
  const { departamentId, sefAnteriorId, caleaDepartamentului } = parametri;

  const [membri, deDeasupra] = await Promise.all([
    citesteMembrii(ctx, departamentId),
    citesteSefulDeDeasupra(ctx, departamentId, caleaDepartamentului),
  ]);

  const plan = planificaEliberarea({
    sefAnteriorId,
    membri,
    sefulDeDeasupra: deDeasupra.id,
    caleaSefuluiDeDeasupra: deDeasupra.cale,
  });
  if (plan.deEliberat.length > 0) {
    await scrieManagerul(ctx, plan.deEliberat, plan.nouManager, ceEsteDejaScris);
  }
}

/** Fișele active din departament, în forma pe care o cer regulile pure. */
async function citesteMembrii(
  ctx: ContextSef,
  departamentId: string,
): Promise<readonly { id: string; managerEmployeeId: string | null }[]> {
  const { data, error } = await ctx.db
    .from("employees")
    .select("id, manager_employee_id")
    .eq("organization_id", ctx.organizationId)
    .eq("department_id", departamentId)
    .is("deleted_at", null);
  if (error !== null) throw mapPostgrestError(error, ctx.requestId);
  return (data ?? []).map((m) => ({ id: m.id, managerEmployeeId: m.manager_employee_id }));
}

/**
 * Șeful primului departament de DEASUPRA care are unul, plus lanțul lui.
 *
 * Urcă pe `departments.path` — care e ordonat de la rădăcină până la
 * departamentul însuși, ținut de `tg_departments_path` — și se oprește la primul
 * strămoș cu manager. Nu la părintele direct: un nivel intermediar fără manager
 * n-are pe cine să ofere, iar a te opri acolo ar lăsa vârful departamentului
 * fără șef deși mai sus există unul. La capătul urcării e conducerea.
 *
 * Departamentele dezactivate se sar la fel ca cele fără manager: un șef dintr-o
 * structură închisă nu e un loc în care să pui pe cineva.
 *
 * `cale` e `manager_path`-ul celui găsit, singura gardă care poate spune dacă
 * destinația atârnă ea însăși de cel pe care vrem să-l urcăm.
 */
async function citesteSefulDeDeasupra(
  ctx: ContextSef,
  departamentId: string,
  caleaDepartamentului: readonly string[],
): Promise<{ id: string | null; cale: readonly string[] }> {
  const stramosi = caleaDepartamentului.filter((id) => id !== departamentId);
  if (stramosi.length === 0) return { id: null, cale: [] };

  const { data, error } = await ctx.db
    .from("departments")
    .select("id, manager_employee_id")
    .in("id", stramosi)
    .eq("organization_id", ctx.organizationId)
    .eq("activ", true)
    .is("deleted_at", null);
  if (error !== null) throw mapPostgrestError(error, ctx.requestId);

  const sefPe = new Map((data ?? []).map((d) => [d.id, d.manager_employee_id]));
  // De la cel mai apropiat strămoș spre rădăcină: `path` vine de sus în jos.
  const sefulId =
    [...stramosi]
      .reverse()
      .map((id) => sefPe.get(id) ?? null)
      .find((s) => s !== null) ?? null;
  if (sefulId === null) return { id: null, cale: [] };

  const fisa = await ctx.db
    .from("employees")
    .select("manager_path")
    .eq("id", sefulId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (fisa.error !== null) throw mapPostgrestError(fisa.error, ctx.requestId);
  // Fișa ștearsă între citire și scriere: un șef inexistent nu e o destinație.
  if (fisa.data === null) return { id: null, cale: [] };

  return { id: sefulId, cale: fisa.data.manager_path };
}

async function scrieManagerul(
  ctx: ContextSef,
  fise: readonly string[],
  managerId: string | null,
  ceEsteDejaScris: string,
): Promise<void> {
  const { data, error } = await ctx.db
    .from("employees")
    .update({ manager_employee_id: managerId, updated_by: ctx.userId })
    .in("id", fise)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    // `.select()` după `.update()`: `employees_update` refuză prin `USING` cu
    // ZERO RÂNDURI ȘI FĂRĂ EROARE. Se compară numărul, nu doar existența: un
    // refuz parțial ar trece neobservat printr-o simplă verificare de `null`.
    .select("id");
  if (error !== null) throw mapPostgrestError(error, ctx.requestId);
  if ((data ?? []).length !== fise.length) {
    throw businessRule(
      `${ceEsteDejaScris}, dar subordonarea a rămas pe jumătate: ${(data ?? []).length} din ${fise.length} fișe au putut fi modificate. Verificați-le din organigramă.`,
    );
  }
}
