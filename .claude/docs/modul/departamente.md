---
tip: modul
titlu: Departamente
aliases: [departamente, structura, organizare]
cai:
  - "src/app/(app)/departamente/**"
  - "src/lib/queries/departments.ts"
  - "src/schemas/department.ts"
  - "supabase/migrations/0004_hr.sql"
tabele: [departments, employees]
permisiuni: [departments:read, departments:create, departments:update, employees:update]
capcane: [17]
citeste_daca:
  - "departament care nu se poate dezactiva → secțiunea „ce refuză”"
  - "cine vede ce după o mutare → [[modul/organigrama]]"
scris_pe: 0815fbff2c885cd44b5768ee25f084f16a9e95b8
scris_la: 2026-09-03
tags: [modul, hr]
---

# Departamente

Structura organizatorică: un arbore de departamente, fiecare cu un manager, plus uneltele
care mută oameni între ele. Ecranul are două vizualizări — listă și organigramă — peste
aceleași date.

Lanțul de subordonare **al oamenilor** (`manager_path`) e altceva și stă la
[[modul/organigrama]]. Aici e arborele de departamente (`departments.path`).

## Ruta

`/departamente`, sub `requireFeature(..., "nucleu")`. Poarta de citire e
`departments:read`, verificată cu `scopeFor` — o cheie absentă întoarce `null`, iar
comparația doar cu `"none"` ar lăsa-o să treacă.

Booleenii de scriere, toți la scope `all`: `poateCrea` și `poateEdita`
(`departments:create` / `departments:update`), `poateMutaPersoane` (`employees:update`).

## Server Actions

`src/app/(app)/departamente/actions.ts` — toate pe `minScope: "all"`.

| Funcție                                             | Permisiune           |
| --------------------------------------------------- | -------------------- |
| `creeazaDepartament`                                | `departments:create` |
| `actualizeazaDepartament`, `mutaDepartament`        | `departments:update` |
| `dezactiveazaDepartament`, `reactiveazaDepartament` | `departments:update` |
| `mutaAngajati`                                      | `employees:update`   |

## `mutaAngajati` — cinci decizii care nu se văd din semnătură

Mesajul „mutați-i în altă structură înainte de dezactivare" trimitea până acum la o unealtă
care nu exista: singura cale era formularul complet al fișei, om cu om.

1. **Schemă îngustă, două câmpuri** — nu `actualizeazaAngajatSchema`, care are zeci de
   câmpuri cu `.default(...)` și ar goli fișa dintr-un payload parțial.
2. **`minScope: "all"`, nu `"team"`.** `actualizeazaAngajat` are azi `team` deși pagina lui
   cere `all` — deci e invocabilă direct, ca endpoint POST, de cineva care n-a văzut
   ecranul. Discrepanța nu se repetă aici. **Poarta acțiunii se aliniază cu poarta paginii,
   nu cu ce pare suficient.**
3. **Departamentul-țintă se verifică explicit că e al organizației.**
   `employees.department_id` e cheie străină simplă, fără componentă pe `organization_id`
   și fără trigger — spre deosebire de `departments.parent_id` și
   `departments.manager_employee_id`, care AU verificarea. E singura relație din trio-ul HR
   pe care baza n-o păzește, deci o păzește acțiunea.
4. **`.select("id")` după `.update()`, cu lungimea comparată.** Politica `employees_update`
   refuză prin `USING` cu zero rânduri și fără eroare; la o mutare în masă, un refuz
   parțial ar fi raportat altfel drept reușită deplină. — capcana #17
5. **Un refuz parțial NU se poate anula.** PostgREST nu deschide o tranzacție peste două
   cereri, deci mesajul spune exact ce s-a întâmplat, cu cifre — nu „a eșuat", ceea ce ar
   fi o minciună despre rândurile deja scrise.

`revalidate:` se **declară** aici, spre deosebire de acțiunile de deasupra din același
fișier, care cheamă `revalidatePath()` din handler. Forma declarativă e cea canonică:
rulează după succesul complet, inclusiv după scrierea jurnalului.

## Ce refuză baza

`public.tg_departments_path` rulează BEFORE INSERT sau UPDATE pe `parent_id` și ridică
P0001 dacă: departamentul superior nu există sau e șters, aparține altei organizații,
structura ar deveni **circulară**, sau arborele ar depăși **12 niveluri**. `path` și
`depth` sunt calculate de trigger, nu trimise de client.

`mutaDepartament` mai adaugă o gardă în acțiune, înaintea bazei: un departament nu poate fi
subordonat lui însuși.

Mutarea unui nod **rescrie subarborele**: `tg_departments_path_cascade` reface `path`-ul
tuturor descendenților.

**Dezactivarea refuză cât timp mai are angajați.** Acțiunea numără fișele active înainte și
întoarce un mesaj de regulă de business, nu o eroare de bază — de aceea există
`mutaAngajati`.

## Ce se mișcă împreună

`creeazaDepartament` și celelalte revalidează `/departamente`, `/angajati` **și**
`/organigrama`: aceleași date, trei ecrane.

O mutare de departament nu schimbă cine vede ce — asta ține de `manager_path`, nu de
`departments.path`. Confuzia dintre cele două arbori e cea mai ușoară greșeală din zonă:
scope-ul `team` NU se uită la departament. — [[modul/organigrama]]

## Când NU e suficientă pagina asta

- Fișa individuală, încadrarea, CNP/IBAN: [[modul/angajati]].
- Cine e „echipa mea" și de ce: [[modul/organigrama]], [[rol/manager]].
