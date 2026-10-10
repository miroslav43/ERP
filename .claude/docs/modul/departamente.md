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
  - "src/config/porti-ruta.ts"
  - "supabase/migrations/0004_hr.sql"
  - "supabase/migrations/0139_cod_departament_optional.sql"
  - "supabase/migrations/0143_seful_iese_din_departament.sql"
tabele: [departments, employees, profiles, organization_members]
permisiuni:
  [
    departments:read,
    departments:create,
    departments:update,
    employees:read,
    employees:update,
    users:update,
  ]
capcane: [2, 17]
citeste_daca:
  - "departament care nu se poate dezactiva → secțiunea „ce refuză”"
  - "departament fără cod, sau cod schimbat → secțiunea „codul”"
  - "șef desemnat, șters sau scos din departament → secțiunea „șeful”"
scris_pe: ed4ad654d64120bfad37e146a32c8fbe4f6159f0
scris_la: 2026-10-10
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

`requireFeature` și `getPermissionMap` pleacă într-un `Promise.all`, nu înlănțuite ca în
preambulul canonic: citesc tabele diferite, iar ordinea porților rămâne aceeași —
`Promise.all` respinge la prima respingere, deci un modul dezactivat dă tot 404 înainte ca
harta de permisiuni să ajungă la ceva. Varianta serială reintroduce un dus-întors de rețea,
nu o verificare.

Booleenii de scriere, toți la scope `all`: `poateCrea` și `poateEdita`
(`departments:create` / `departments:update`), `poateMutaPersoane` (`employees:update`).
`poateInvita` și `poateSchimbaRoluri` cer `users:update = all`, adică `org_admin`: `hr`
n-are niciun `users:*` (`0002_authz.sql`), deci nu-i apar nici „Invită un cofondator", nici
semnalul „rol de Angajat" ca link spre permisiunile șefului.

Legăturile spre alte module trec prin poarta paginii-ȚINTĂ, nu a structurii:
`poateDeschide(..., contextPorti)` din `src/config/porti-ruta.ts`, cu lista de module
(`getEnabledFeatures`) adusă în același `Promise.all` cu citirile. Ce nu se poate deschide
LIPSEȘTE de pe ecran, în loc să ducă într-un refuz; „Instruiri SSM" are poartă dublă —
ținta plus `employees:read = team`, fiindcă matricea se filtrează pe oameni.

## Panoul — deschis din adresă

Panoul deschis se derivă din `?departament=<id>`, cu sentinela `?departament=nerepartizati`
pentru bandă: devine un link pe care îl poate trimite orice alt modul, iar un id necunoscut
— din altă firmă sau ascuns de RLS — lasă panoul ÎNCHIS, nu deschide unul gol. După creare
adresa sare pe departamentul nou, iar după o mutare toastul oferă deschiderea țintei,
fiindcă panoul rămâne pe sursă. Vecinii din arbore se deschid în ACELAȘI panou: cardul
numără subarborele, panoul doar membrii direcți.

Rândul „Manager" are trei stări, și a doua e tăcută: nume legat când embed-ul vine; „în
afara echipei dumneavoastră" când `managerId` există dar embed-ul e `null` (RLS a ascuns
fișa, deci nici linkul nu s-ar deschide); „nedesemnat" când lipsesc amândouă.

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

## Codul — opțional, editabil, și cheia conducerii

`departments.cod` nu mai e obligatoriu: `0139_cod_departament_optional.sql` scoate
`not null`-ul pus de `0004_hr.sql`. Obligatorie la creare rămâne doar denumirea, iar ea e și
primul câmp al formularului — unul care începe cu un câmp facultativ îl face să pară cerut.

Câmpul gol devine `null`, **nu șir vid** — `codOptional` din `src/schemas/department.ts`.
Diferența e în bază: indexul unic `departments_org_cod_uniq` e pe `lower(cod)` și nu e
declarat `nulls not distinct`, deci oricâte departamente fără cod coexistă, iar unicitatea
mușcă în continuare pentru cine completează codul. Două șiruri vide s-ar ciocni la al doilea.

CHECK-ul `departments_cod_len` nu trebuie rescris: evaluat pe NULL dă NULL, iar Postgres
cere „not false", nu „true" — deci lasă NULL să treacă și continuă să interzică șirul vid și
codurile peste 32 de caractere.

Codul **se poate edita** (`actualizeazaDepartamentSchema` nu-l mai omite): cine a creat
departamente fără cod și își face nomenclatura peste un an trebuie să le poată completa fără
să refacă departamentul, pierzând istoricul. De aceea `"cod"` e și în
`CAMPURI_AUDITATE_ACTUALIZARE`.

`lower(cod) = 'conducere'` e cheia după care triggerele din
`0107_departamentul_conducere.sql` recunosc conducerea firmei. Un cod NULL nu se potrivește
niciodată (comparația dă NULL, deci fals în `where`), deci un departament fără cod nu devine
din greșeală conducerea. Cine **schimbă** codul conducerii pierde repartizarea automată:
comportament, nu defect, iar auditul e singurul loc din care se mai află cine și când.
`esteConducerea` din `panou-departament.tsx` face aceeași verificare, cu gardă pe `null`.

Tipul urcă neschimbat prin toate straturile — `string | null` din `RandDepartament` până în
`OptiuneDepartament` — iar interfața **nu pune substitut** pentru codul lipsă (nici „—",
nici denumirea repetată): ar arăta ca un cod adevărat.

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

## Citiri

`src/lib/queries/departments.ts` dă `structuraDepartamentelor`, `angajatiPentruStructura` și
`rolurilePeUtilizator`. Pozele vin din `toateAvatarurile` (`src/lib/queries/profile.ts`),
**nu** din `avataturiPeUtilizatori`: fără filtrul pe lista de conturi, citirea nu mai
depinde de celelalte și încape în același `Promise.all` cu ele (val în care intră și
`getEnabledFeatures`), deci ecranul are un singur val de citiri, nu unul urmat de al doilea.
`avataturiPeUtilizatori` rămâne pe loc, cu ceilalți apelanți ai ei. Fișierul e
`server-only`: importat dintr-o componentă client, oprește build-ul.

`toateAvatarurile` primește `organizationId` și filtrează pe el **explicit**. Filtrul nu e
redundant și nu se scoate: un profil e vizibil pe CONT, nu pe firma din sesiune, iar
conturile membre în două organizații există în producție — fără filtru, `/departamente` al
uneia ar atinge și membrii celeilalte. Restrângerea se face în doi pași — întâi membrii
activi, apoi profilurile lor — fiindcă între `profiles` și `organization_members` nu există
cheie străină, deci PostgREST n-are pe ce să facă embed; ca `rolurileConturilor`.

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

**Dezactivarea refuză cât timp mai are angajați**, și numără ORICE status — doar
`deleted_at is null`, fără filtru pe `status` (fixat în `actions-stare.test.ts`). Ecranul
numără altfel: efectivul cardului și banda nerepartizaților iau doar activii, fiindcă un
`incetat` n-are unde fi repartizat. Deci un departament care arată „gol" poate refuza
dezactivarea, iar mesajul de refuz poartă linkul spre lista angajaților departamentului —
singurul loc unde se văd și cei nenumărați. E o regulă de business a acțiunii, nu o eroare
de bază, și de aceea există `mutaAngajati`.

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
- Railul panoului, vecinii din arbore și „rol de Angajat” ca link: [[strat/navigare]].
