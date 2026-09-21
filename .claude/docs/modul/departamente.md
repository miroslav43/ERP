---
tip: modul
titlu: Departamente
aliases: [departamente, structura, organizare]
cai:
  - "src/app/(app)/departamente/**"
  - "src/lib/queries/departments.ts"
  - "src/lib/queries/profile.ts"
  - "src/lib/departamente/sef.ts"
  - "src/domain/departments/subordonare-sef.ts"
  - "src/schemas/department.ts"
  - "supabase/migrations/0004_hr.sql"
  - "supabase/migrations/0139_cod_departament_optional.sql"
  - "supabase/migrations/0143_seful_iese_din_departament.sql"
tabele: [departments, employees, profiles, organization_members]
permisiuni: [departments:read, departments:create, departments:update, employees:update]
capcane: [2, 17]
citeste_daca:
  - "departament care nu se poate dezactiva → secțiunea „ce refuză”"
  - "departament fără cod, sau cod schimbat → secțiunea „codul”"
  - "șef desemnat, șters sau scos din departament → secțiunea „șeful”"
scris_pe: 5e61f1319db78905cd113ccce7700c8da2fd7d16
scris_la: 2026-09-21
tags: [modul, hr]
---

# Departamente

Structura organizatorică: un arbore de departamente, fiecare cu un manager, plus uneltele
care mută oameni între ele. Ecranul are două vizualizări — listă și organigramă — peste
aceleași date.

Lanțul de subordonare **al oamenilor** (`manager_path`) e alt arbore și se citește la
[[modul/organigrama]] — dar se SCRIE de aici, la fiecare schimbare de șef. Aici e arborele
de departamente (`departments.path`).

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

## Codul — opțional, editabil, și cheia conducerii

`departments.cod` nu mai e obligatoriu: `0139_cod_departament_optional.sql` scoate
`not null`-ul pus de `0004_hr.sql`. Obligatorie la creare rămâne doar denumirea, iar ea e
și primul câmp al formularului — un formular care începe cu un câmp facultativ îl face să
pară cerut.

Câmpul gol devine `null`, **nu șir vid** — `codOptional` din `src/schemas/department.ts`.
Diferența e în bază: indexul unic `departments_org_cod_uniq` e pe `lower(cod)` și nu e
declarat `nulls not distinct`, deci oricâte departamente fără cod coexistă în aceeași
firmă, iar unicitatea mușcă în continuare pentru cine chiar completează codul. Două șiruri
vide s-ar fi ciocnit la al doilea departament.

CHECK-ul `departments_cod_len` rămâne neatins și nu trebuie rescris: evaluat pe NULL dă
NULL, iar Postgres cere „not false", nu „true" — deci lasă NULL să treacă și continuă să
interzică șirul vid și codurile peste 32 de caractere.

Codul **se poate edita**: `actualizeazaDepartamentSchema` nu-l mai omite din
`creeazaDepartamentSchema`, fiindcă cine a creat departamente fără cod și își face
nomenclatura peste un an trebuie să le poată completa fără să dezactiveze și să refacă
departamentul, pierzând istoricul. De aceea `"cod"` e și în `CAMPURI_AUDITATE_ACTUALIZARE`.

`lower(cod) = 'conducere'` e cheia după care triggerele din
`0107_departamentul_conducere.sql` recunosc conducerea firmei. Un cod NULL nu se potrivește
niciodată — comparația se evaluează la NULL, deci fals în `where` — deci un departament
fără cod nu devine din greșeală conducerea. În schimb, cine **schimbă** codul conducerii
pierde repartizarea automată: comportament, nu defect, iar jurnalul de audit e singurul loc
din care se mai află cine l-a schimbat și când. `esteConducerea` din `panou-departament.tsx`
face aceeași verificare, cu aceeași gardă pe `null`.

Tipul urcă neschimbat prin toate straturile — `RandDepartament.cod`, `DepartamentEcran.cod`
și `OptiuneDepartament.cod` sunt `string | null`. Interfața **nu pune substitut** pentru
codul lipsă (nici „—", nici denumirea repetată): ar arăta ca un cod adevărat. În combobox-ul
de mutare cheia `secundar` lipsește cu totul din opțiune, nu e pusă pe `undefined` —
`exactOptionalPropertyTypes` o respinge pe a doua formă.

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
apel, o ramură nouă intra în structură atârnată unde se nimerea. Calea strămoșilor vine din
`RETURNING` (`.select("id, path")`), calculată de `tg_departments_path`.

Ușa are **două sensuri**: „manager → gol" cheamă `elibereazaSubordonarea`, care desface
numai fișele al căror manager DIRECT e fostul șef și le urcă la cel de deasupra — exact ce
scrisese desemnarea. Fără ea, ștergerea managerului lăsa subordonarea pe loc.

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
schimbat semnătura. Fișierul e `server-only`: importat dintr-o componentă client, oprește
build-ul.

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

**Cine e scos din departamentul pe care îl conduce nu-l mai conduce.**
`trg_employees_75_sef_departament` (`0143_seful_iese_din_departament.sql`) golește
`departments.manager_employee_id` la orice UPDATE care schimbă `department_id` sau șterge
logic fișa — fără eroare, fără să ceară nimic. De aceea panoul primește `managerId` și
avertizează ÎNAINTE de apăsare că persoana bifată conduce departamentul. Triggerul nu
atinge nici rolul de aplicație, nici `manager_path`.

## Ce se mișcă împreună

`creeazaDepartament` și celelalte revalidează `/departamente`, `/angajati` **și**
`/organigrama`: aceleași date, trei ecrane.

`mutaDepartament` nu schimbă cine vede ce: scope-ul `team` se calculează din `manager_path`,
nu din `departments.path`, iar acțiunea nu atinge nicio fișă. **Desemnarea sau ștergerea
unui șef, în schimb, schimbă exact asta**: scrie `manager_employee_id`, deci rescrie
subarbori de `manager_path`, și odată cu ei aprobările din concedii, pontaj și diurnă. —
[[modul/organigrama]]

## Când NU e suficientă pagina asta

- Fișa individuală, încadrarea, CNP/IBAN: [[modul/angajati]].
- Cine e „echipa mea" și de ce: [[modul/organigrama]], [[rol/manager]].
