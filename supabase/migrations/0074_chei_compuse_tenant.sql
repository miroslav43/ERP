-- supabase/migrations/0074_chei_compuse_tenant.sql
-- Chei unice compuse `(id, organization_id)` pe `employees` și `departments`.
--
-- Migrare separată, scurtă, deliberat: e o unealtă de infrastructură
-- pentru TOT proiectul, nu o bucată din modulul de cursuri care urmează. Dacă
-- modulul se amână sau se rescrie, asta rămâne; iar dacă datele n-ar permite
-- constrângerea, eșecul e izolat aici, nu îngropat într-o migrare de 1 200 de
-- linii pe jumătate aplicată.
--
-- La ce servește: tiparul din 0014_checklist.sql ancorează FK-urile pe tenant
-- prin chei compuse — `(template_id, organization_id) references
-- checklist_templates (id, organization_id)`. Constrângerea face imposibil, la
-- nivel de bază, ca un rând al firmei A să trimită către un rând al firmei B;
-- RLS nu poate garanta asta singură, pentru că un FK simplu nu știe nimic
-- despre organizație. `employees` n-avea decât cheia primară pe `id`, deci
-- niciun modul nu putea ancora astfel o trimitere către o fișă de angajat.
--
-- Cost: un index unic pe o tabelă cu maximum 8 rânduri per firmă în tot parcul
-- de clienți de azi. `employees.id` e deja unic prin cheia primară, deci
-- perechea nu poate eșua pe datele existente — constrângerea e strict
-- informație pentru planificator și pentru FK-uri, nu o restricție nouă.

begin;

alter table public.employees
  add constraint employees_id_org_uk unique (id, organization_id);

comment on constraint employees_id_org_uk on public.employees is
  'Ancoră de tenant pentru chei străine compuse: (employee_id, organization_id) references employees (id, organization_id). Face imposibilă trimiterea către fișa altei firme, ceea ce RLS singură nu poate garanta.';

alter table public.departments
  add constraint departments_id_org_uk unique (id, organization_id);

comment on constraint departments_id_org_uk on public.departments is
  'Aceeași ancoră, pentru trimiterile către un departament. Prima cerere vine din regulile de atribuire a cursurilor (0078), dar constrângerea nu aparține acelui modul: orice tabelă viitoare care ține un department_id o vrea.';

commit;
