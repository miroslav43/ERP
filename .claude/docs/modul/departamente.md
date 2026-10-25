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
  - "src/schemas/mesaje-zod.ts"
  - "src/config/porti-ruta.ts"
  - "supabase/migrations/0004_hr.sql"
  - "supabase/migrations/0139_cod_departament_optional.sql"
  - "supabase/migrations/0143_seful_iese_din_departament.sql"
  - "supabase/migrations/0152_legaturi_fara_fk_compus.sql"
  - "supabase/migrations/0233_oracol_intre_firme.sql"
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
capcane: [2]
citeste_daca:
  - "departament care nu se poate dezactiva → secțiunea „ce refuză”"
  - "departament fără cod, sau cod schimbat → subpagina „codul departamentului”"
  - "șef desemnat, șters sau scos din departament → subpagina „scrierile”"
scris_pe: cd77c37564a0a2474dda087e9d2ec85035b57e46
scris_la: 2026-10-25
tags: [modul, hr]
---

# Departamente

Structura organizatorică: un arbore de departamente, fiecare cu un manager, plus uneltele
care mută oameni între ele. Ecranul are două vizualizări — listă și organigramă — peste
aceleași date.

Lanțul de subordonare **al oamenilor** (`manager_path`) e alt arbore și se citește la
[[modul/organigrama]] — dar se SCRIE de aici, la fiecare schimbare de șef. Aici e arborele
de departamente (`departments.path`).

## Paginile modulului

| Pagină                         | Ce ține                                                           |
| ------------------------------ | ----------------------------------------------------------------- |
| [[modul/departamente/actiuni]] | Server Actions, desemnarea șefului și `mutaAngajati`              |
| [[modul/departamente/cod]]     | `departments.cod`: opțional, editabil, și cheia conducerii firmei |

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
P0001 dacă: superiorul nu e în firma rândului (inexistent, șters sau străin: un mesaj,
`0233_oracol_intre_firme.sql`), structura ar deveni **circulară**, sau arborele ar depăși
**12 niveluri**. `path` și `depth` sunt calculate de trigger, nu trimise de client.

Garda de firmă vine ÎNAINTEA căutării superiorului, cu 42501 neutru, fiindcă un trigger
BEFORE rulează înaintea clauzei `WITH CHECK`: ordinea e ce ține răspunsul identic pentru un
id inexistent și pentru unul al altei firme. Aceeași gardă stă pe
`internal.departament_sef_in_firma` (`0152_legaturi_fara_fk_compus.sql`), triggerul care
cere ca șeful ales să fie o fișă din firma departamentului, cu P0001. Amândouă se aplică
doar când rândul caută ceva: un nod rădăcină fără superior și fără șef nu întreabă nimic.

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
de bază, și de aceea există `mutaAngajati`. Antetul listei desparte la fel numărul de
departamente, în active și inactive, dar numai când există vreunul dezactivat: unul
dezactivat rămâne pe ecran, cu insigna lui, deci numărul singur l-ar da drept viu.

**Cine e scos din departamentul pe care îl conduce nu-l mai conduce.**
`trg_employees_75_sef_departament` (`0143_seful_iese_din_departament.sql`) golește
`departments.manager_employee_id` la orice UPDATE care schimbă `department_id` sau șterge
logic fișa — fără eroare, fără să ceară nimic. De aceea panoul primește `managerId` și
avertizează ÎNAINTE de apăsare că persoana bifată conduce departamentul; același efect îl
spune și câmpul „Manager" al formularelor de departament, din `conduceDepartamentulCurent`
(`src/app/(app)/departamente/tipuri.ts`), când omul desemnat conduce departamentul din care
ar pleca. Triggerul nu atinge nici rolul de aplicație, nici `manager_path`.

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
