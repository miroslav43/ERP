---
tip: modul
titlu: Organigramă
aliases: [organigrama, subordonare, manager_path]
cai:
  - "src/app/(app)/organigrama/**"
  - "src/lib/queries/employees.ts"
  - "supabase/migrations/0004_hr.sql"
  - "supabase/migrations/0005_hr_rls.sql"
tabele: [employees, organization_members, departments]
permisiuni: [employees:read]
capcane: [18]
citeste_daca:
  - "scope `team` care vede prea mult sau prea puțin → secțiunea `manager_path`"
scris_pe: 0815fbff2c885cd44b5768ee25f084f16a9e95b8
scris_la: 2026-09-03
tags: [modul]
---

# Organigramă

Un singur ecran, fără nicio scriere. Dar e **vizualizarea structurii pe care se sprijină
tot scope-ul `team` din proiect**: cine e „echipa mea" nu se decide nicăieri altundeva.

Structura de departamente și uneltele care o schimbă sunt la [[modul/departamente]].

## `manager_path` — lanțul care definește „echipa"

`employees.manager_path` e un tablou de UUID-uri care conține lanțul de la vârf până la
angajat, **inclusiv angajatul însuși**. Deci:

```
„X e în echipa lui M"  ⇔  X.manager_path @> array[M]
```

Consecința care surprinde: `app.is_manager_of(org, eu)` e **adevărat pentru propria fișă**.
Scope-ul `team` include întotdeauna omul care îl poartă. Unde asta ar însemna „își aprobă
singur", excluderea se face explicit în fluxul respectiv, niciodată prin scope — v.
[[rol/manager]].

A doua consecință: `manager_path` conține **tot subarborele**, nu doar șeful direct. Șeful
șefului trece la fel de bine. Unde cerința e „managerul direct", predicatul e altul —
`app.este_manager_direct`, pe `manager_employee_id` — și asta e diferența pe care se
sprijină scrierea KPI din [[modul/evaluari]].

## Ce refuză baza când lanțul e greșit

`public.tg_employees_manager_path` rulează BEFORE INSERT sau UPDATE pe
`manager_employee_id` și ridică P0001 în patru cazuri:

- managerul indicat nu există sau are fișa ștearsă;
- managerul aparține altei organizații;
- relația ar deveni **circulară** (`new.id` e deja în lanțul managerului);
- lanțul ar depăși **12 niveluri**.

Coloana e calculată de trigger, nu trimisă de client: politica de INSERT din `0005` cere
literal `manager_path = '{}'`. Un client care încearcă s-o scrie e respins.

Mutarea unui om **rescrie subarborele lui**: `tg_employees_manager_path_cascade` reface
prefixul la toți cei care îl aveau în lanț. Deci o singură schimbare de șef poate muta
tăcut ce văd zeci de oameni cu scope `team` — inclusiv aprobările din concedii, pontaj și
diurnă.

## Citirea ecranului

`arboreleManagerial(organizationId, scope, propriaFisaId)` din
`src/lib/queries/employees.ts`. Poarta e `employees:read`, iar `scope === null` sau
`"none"` dă `AccesRestrictionat`. Cu scope diferit de `all`, pagina trimite propria fișă,
ca arborele să pornească de acolo.

Rolurile conturilor vin dintr-o **a doua** interogare, `rolurileConturilor`, nu dintr-un
embed: între `employees` și `organization_members` nu există cheie străină, iar PostgREST
refuză embed-ul fără ea. Nu cere permisiune în plus — politica cere doar apartenența la
organizație.

`construiesteOrganigrama` întoarce, pe lângă arbore, și `radaciniFaraManagerVizibil`:
oameni al căror șef există, dar nu e vizibil sub scope-ul curent. Ei nu se aruncă și nu se
lipesc la rădăcină în tăcere — ecranul îi arată ca atare, fiindcă „nu văd șeful" e o stare
diferită de „n-are șef".

## Ce refuză baza tăcut

- **Un angajat fără fișă principală de angajat are `team` peste mulțimea vidă.**
  Subordonarea trăiește în `employees`, nu în `organization_members`; un cont de manager
  fără fișă vede liste goale peste tot, fără nicio eroare.
- **Embed-urile care traversează spre module fără permisiune vin NULL, nu în eroare** —
  cazul canonic e `vehicles!vehicle_id` pentru un manager. — capcana #18

## Când NU e suficientă pagina asta

- Schimbarea structurii: [[modul/departamente]].
- Fișa individuală și încadrarea: [[modul/angajati]].
