---
tip: modul
titlu: Departamente — scrierile și șeful
cai:
  - "src/app/(app)/departamente/**"
  - "src/lib/departamente/sef.ts"
  - "src/domain/departments/subordonare-sef.ts"
  - "src/schemas/department.ts"
  - "src/schemas/mesaje-zod.ts"
  - "supabase/migrations/0143_seful_iese_din_departament.sql"
tabele: [departments, employees]
permisiuni: [departments:create, departments:update, employees:update]
capcane: [17]
scris_pe: cd77c37564a0a2474dda087e9d2ec85035b57e46
scris_la: 2026-10-25
tags: [modul, hr]
---

# Departamente — scrierile și șeful

Secțiune extrasă din [[modul/departamente]]: Server Actions ale structurii, ce mai scrie o
desemnare de șef în afara lui `departments` și deciziile lui `mutaAngajati`.

## Server Actions

`src/app/(app)/departamente/actions.ts` — toate pe `minScope: "all"`. Pragul, filtrele și
`.select()`-ul de după scriere le fixează, pe clientul Supabase fals,
`actions-structura.test.ts` și `actions-stare.test.ts` din același director.

| Funcție                                             | Permisiune           |
| --------------------------------------------------- | -------------------- |
| `creeazaDepartament`                                | `departments:create` |
| `actualizeazaDepartament`, `mutaDepartament`        | `departments:update` |
| `dezactiveazaDepartament`, `reactiveazaDepartament` | `departments:update` |
| `mutaAngajati`                                      | `employees:update`   |

Mesajele de validare nu mai ies englezește: `src/schemas/department.ts` importă
`src/schemas/mesaje-zod.ts`, harta globală care dă un text românesc oricărei reguli fără
mesaj propriu — o valoare străină pe `muta_managerul_in_departament` iese „Valoarea nu are
formatul așteptat.". Mesajele explicite rămân calea bună și au prioritate (ordinea de
rezolvare din Zod 4): `denumire` îl are și pentru limita de 160 de caractere, nu doar
pentru minimul de 2.

## Șeful — o desemnare scrie și pe `employees`

`creeazaDepartament` și `actualizeazaDepartament` nu se opresc la `departments`: prin
`src/lib/departamente/sef.ts` scriu și `employees.manager_employee_id` — subordonarea, nu
doar rolul de manager (acela cere `org_admin`, fiindcă se scrie în `organization_members`).
Un `hr` iese deci cu structura întreagă: pe `employees` are `employees:update = all`.

`aplicaSubordonarea` ridică șeful sub șeful primului departament de DEASUPRA care are unul
(nivelurile fără manager și cele dezactivate se sar) și abia apoi leagă membrii de el —
invers, `tg_employees_manager_path` aruncă P0001 la ciclu și anulează tot lotul, fiindcă
șeful e adesea subordonat cuiva din propriul departament. Regula pură:
`src/domain/departments/subordonare-sef.ts`.

Se cheamă **și la creare**, deși departamentul e gol: membri n-are, dar vârf are — fără
apel, o ramură nouă intră în structură atârnată unde se nimerește. Calea strămoșilor vine
din `RETURNING` (`.select("id, path")`), calculată de `tg_departments_path`.

Ușa are **două sensuri**: „manager → gol" cheamă `elibereazaSubordonarea`, care desface
numai fișele al căror manager DIRECT e fostul șef și le urcă la cel de deasupra — exact ce
scrisese desemnarea.

## `mutaAngajati` — cinci decizii care nu se văd din semnătură

1. **Schemă îngustă, două câmpuri** — nu `actualizeazaAngajatSchema`, care are zeci de
   câmpuri cu `.default(...)` și ar goli fișa dintr-un payload parțial.
2. **`minScope: "all"`, nu `"team"`.** Poarta acțiunii se aliniază cu poarta paginii, nu cu
   ce pare suficient: orice acțiune e invocabilă direct, ca endpoint POST, de cineva care
   n-a văzut ecranul.
3. **Departamentul-țintă se verifică explicit că e al organizației.**
   `employees.department_id` e cheie străină simplă, fără componentă pe `organization_id` și
   fără trigger — spre deosebire de `departments.parent_id` și
   `departments.manager_employee_id`, care AU verificarea. Singura relație din trio-ul HR pe
   care baza n-o păzește, deci o păzește acțiunea.
4. **`.select("id")` după `.update()`, cu lungimea comparată.** Politica `employees_update`
   refuză prin `USING` cu zero rânduri și fără eroare; la o mutare în masă, un refuz
   parțial ar fi raportat altfel drept reușită deplină. — capcana #17
5. **Un refuz parțial NU se poate anula.** PostgREST nu deschide o tranzacție peste două
   cereri, deci mesajul spune cu cifre ce s-a întâmplat — „a eșuat" ar fi o minciună despre
   rândurile deja scrise.

`revalidate:` se **declară** aici, spre deosebire de acțiunile de deasupra din același
fișier, care cheamă `revalidatePath()` din handler. Forma declarativă e cea canonică:
rulează după succesul complet, inclusiv după jurnal.
