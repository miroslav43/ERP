---
tip: modul
titlu: Departamente
aliases: [departamente, structura, organizare]
cai:
  - "src/app/(app)/departamente/**"
  - "src/lib/queries/departments.ts"
  - "src/lib/queries/profile.ts"
  - "src/schemas/department.ts"
  - "supabase/migrations/0004_hr.sql"
tabele: [departments, employees, profiles, organization_members]
permisiuni: [departments:read, departments:create, departments:update, employees:update]
capcane: [2, 17]
citeste_daca:
  - "departament care nu se poate dezactiva → secțiunea „ce refuză”"
  - "cine vede ce după o mutare → [[modul/organigrama]]"
scris_pe: 711e5225e1df2ceab9324037466c87fda8abd8a0
scris_la: 2026-09-04
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

`requireFeature` și `getPermissionMap` pleacă împreună, într-un `Promise.all`, nu
înlănțuite ca în preambulul canonic: citesc tabele diferite și niciuna n-o alimentează pe
cealaltă, deci înlănțuirea costa un dus-întors în plus, integral rețea. Ordinea porților
rămâne aceeași — `requireFeature` cheamă `notFound()`, iar `Promise.all` respinge la prima
respingere, deci un modul dezactivat dă tot 404 înainte ca harta de permisiuni să fie
folosită la ceva. Cine „repară" forma la loc în varianta serială reintroduce latența, nu o
verificare.

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

## Citiri

`src/lib/queries/departments.ts` dă `structuraDepartamentelor`, `angajatiPentruStructura`
și `rolurilePeUtilizator`. Pozele vin din `toateAvatarurile`
(`src/lib/queries/profile.ts`), **nu** din `avataturiPeUtilizatori`: fără filtrul pe lista
de conturi, citirea nu mai depinde de rezultatul celorlalte și încape în același
`Promise.all` cu ele. Ecranul are astfel un singur val de citiri, nu unul urmat de al
doilea. `avataturiPeUtilizatori` rămâne pe loc, cu ceilalți apelanți ai ei — nu i s-a
schimbat semnătura.

`toateAvatarurile` primește `organizationId` și filtrează pe el **explicit**. Filtrul nu e
redundant și nu se scoate: un profil e vizibil pe CONT, nu pe firma din sesiune, iar
conturile membre în două organizații există în producție — fără filtru, `/departamente` al
uneia ar atinge și membrii celeilalte. Restrângerea se face în doi pași — întâi membrii
activi ai organizației, apoi profilurile lor — fiindcă între `profiles` și
`organization_members` nu există cheie străină, deci PostgREST n-are pe ce să facă embed;
aceeași formă ca la `rolurileConturilor` din `src/lib/queries/employees.ts`.

Ambii pași trec prin `citesteTot`, cu cursor keyset: lista nu se oprește tăcut la plafonul
PostgREST. — capcana #2

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
