---
tip: modul
titlu: Pontaj — planul săptămânii — planul, faptul și concediul aprobat
aliases: [pontaj-saptamana-concediu]
cai:
  - "src/domain/attendance/plan-si-fapt.ts"
  - "src/app/(app)/pontaj/saptamana/**"
  - "src/app/(portal)/portal/pontajul-meu/saptamana/**"
tabele: [attendance_entries, attendance_week_submissions, attendance_week_submission_days]
permisiuni: [attendance:create]
feature: attendance
capcane: []
scris_pe: 6e0792e9aa37ea9f4b874d856489a4f0b9344c20
scris_la: 2026-10-29
tags: [modul, hr]
---

# Pontaj — planul săptămânii — planul, faptul și concediul aprobat

Secțiune extrasă din [[modul/pontaj/saptamana]]: corpul paginii trecuse de plafonul dur,
iar precedența plan/fapt la citire, ziua de concediu sărită de RPC și blocarea ei în
formular sunt partea care nu se schimbă odată cu varianta de pontaj.

## Planul se leagă de fapt la CITIRE, niciodată printr-o a doua scriere

`src/domain/attendance/plan-si-fapt.ts` (pur, cu teste) — `ziuaInitialaPlan(data,
planificata, pontata)`. Îl folosesc AMÂNDOUĂ ecranele planului: `/pontaj/saptamana` și
`/portal/pontajul-meu/saptamana`.

O scriere ar fi modificat, după fapt, planul unei săptămâni deja trimise sau aprobate —
adică ar fi rescris ce a decis cineva, fără urmă.

Precedența e pe **CÂMP, nu pe rând**, și ăsta e cazul purtător al modulului: o zi deschisă
cu „Am intrat" și neînchisă are `ora_sfarsit` null. Copiată peste plan, ar fi golit
intervalul planificat — iar `trimite_saptamana_pontaj` face `delete` + reinserare (0084),
deci următoarea trimitere l-ar fi șters și din bază, fără nicio eroare. Observația NU se
preia deloc: nota zilei lucrate și nota intenției sunt două texte diferite.

Tot din FAPT se decide și dacă ziua mai poate fi editată: `leave_request_id` completat pe
rândul din `attendance_entries` înseamnă concediu deja aprobat, deci `ziuaInitialaPlan`
întoarce `blocata: true` și un `motivBlocare` derivat din `tip_zi` (`etichetaBlocare`).
Textul se desparte pe fel de concediu fiindcă „concediu", „medical" și „fără plată" nu se
corectează cu aceleași hârtii; un `tip_zi` necunoscut cade pe mesajul generic, nu pe
excepție. O zi de concediu doar CERUT n-are rând în pontaj, deci rămâne editabilă —
cererea poate fi respinsă.

Cele două câmpuri sunt OPȚIONALE în `ZiPontataCitita`, ca o citire care nu le aduce să nu
blocheze din greșeală. Reversul: le aduce `COLOANE_INTRARE` din `intrariLuna`, iar scoase
de acolo blocarea dispare TĂCUT — ziua redevine editabilă, fără nicio eroare de tip.
`plan-si-fapt.test.ts` ține și cazul ăsta.

Citirea e `intrariLuna(org, [fisa], …)`, **nu** `intrariProprii` — a doua nu filtrează pe
`employee_id` și se bazează pe RLS, care pentru scope `all` nu îngustează nimic.

## Ziua cu concediu aprobat nu se planifică — se SARE peste ea

Pontajul se scrie pe două drumuri, iar garda de concediu stătea doar pe unul:
`salveazaZiPontaj` refuza ziua din `0013` încoace, `trimite_saptamana_pontaj` verifica
luna deschisă, ziua de luni, modulul activ și angajatul din organizație, dar nu și dacă
ziua e deja concediu. `0133` o pune și pe drumul săptămânii.

Nu refuză săptămâna întreagă — ar fi cerut omului să ghicească ziua care deranjează:
zilele cu concediu se omit din reinserare, restul se salvează, iar funcția întoarce
datele omise în `zile_sarite`. Dovada e `attendance_entries` cu `leave_request_id`
completat, **nu** `leave_requests`: aceeași coloană pe care o citește garda din
`salveazaZiPontaj`, deci două verificări pe aceeași dovadă, nu pe două surse care pot
diverge.

**Omisiunea e tăcută în bază** — ziua pur și simplu nu apare în
`attendance_week_submission_days`, fără nicio eroare.

Citirea rezultatului în acțiune e defensivă deliberat: RPC-ul e tipat `Json`, iar o formă
neașteptată n-are voie să arunce peste un plan care S-A SALVAT deja — de aceea `id` cade
pe șirul gol, nu pe excepție. `conflictSuspendare` și `avertismentReluare` rămân `null`:
planul e în viitor, iar suspendarea pentru absențe se constată din pontajul realizat.

Poarta pozitivă e `tests/rls/proba-saptamana-concediu.sql`, pe bancul local: nu că ziua
de concediu e blocată, ci că restul săptămânii chiar se salvează, că ziua sărită e
raportată, că rândul de concediu din pontaj rămâne neatins și că o săptămână fără
concediu nu raportează nimic.

## Blocarea stă ÎN formular, nu după trimitere

Garda de server e corectă și tăcută, adică exact combinația greșită pentru cel care
completează: casetele primeau text, butonul se apăsa, iar omul afla abia din răspuns că
din cinci zile au contat trei. Deci ziua cu concediu aprobat se blochează în formular:
`blocata` dezactivează toate cele patru controale ale rândului — modul de prezență, cele
două `IntrareOra` și observațiile — iar `motivBlocare` se randează pe ZI, lângă câmpurile
moarte, nu într-un mesaj de sus. `actualizeazaZi` refuză oricum ziua blocată, ca al
cincilea control adăugat mâine să nu fie o portiță; la fel `copiazaPeSaptamana`, care
sare peste ea în loc s-o precompleteze.

Zilele blocate NU pleacă deloc spre server. Serverul le-ar sări oricum, dar le-ar și
RAPORTA, iar avertismentul s-ar aprinde după fiecare trimitere pentru zile pe care nimeni
nu le-a atins — un avertisment repetat fără cauză se învață să fie ignorat. Filtrarea
păstrează indexul înainte de a tăia rândurile, fiindcă `intervalDeTrimis` decide din el
dacă ziua e weekend (`INDICI_WEEKEND`): renumerotat după filtrare, o sâmbătă ar fi plecat
ca zi lucrătoare.

Efectul lateral e tot tăcut și e de așteptat: o zi care avea deja rând de plan îl PIERDE
la prima trimitere de după aprobarea concediului — `0133` șterge toate zilele submisiei
înainte de reinserare, iar ziua filtrată nu se mai reinserează.

Garda de server rămâne pentru CURSĂ, și acolo e singura: un concediu aprobat între
încărcarea paginii și apăsarea butonului pleacă de pe ecran (n-avea de unde ști), e sărit
în RPC și raportat. Abia atunci se aprinde lanțul de deasupra — `zileSarite` din
`RezultatCuAvertismente` (`src/app/(app)/pontaj/avertismente.ts`) și rândul `role="alert"`
din `FormularSaptamana`. Rândul stă în formularul PARTAJAT, deci ajunge pe amândouă
ecranele fără nimic de duplicat.

Lanțul ăsta e însă EFEMER, și e singurul: `zileSarite` e `useState` în
`FormularSaptamana`, populat doar din răspunsul unei trimiteri reușite. `router.refresh()`
nu-l atinge, dar reîncărcarea paginii îl pierde, iar navigarea la altă săptămână îl
golește — amândouă paginile randează formularul cu `key={saptamanaStart}`, deci
schimbarea săptămânii remontează componenta. Nicio citire de server nu recalculează
zilele sărite: `citesteSaptamanaPontaj` întoarce zilele care EXISTĂ, iar cea sărită tocmai
lipsește. Cine închide ecranul fără să citească rândul nu mai are de unde-l afla decât
retrimițând săptămâna.

Ce rămâne descoperit: o cerere aprobată a cărei sincronizare cu pontajul a căzut n-are
rând în `attendance_entries`, deci n-o vede nici garda de săptămână, nici cea de zi, nici
blocarea din formular — toate trei citesc aceeași dovadă, deci cad împreună. Recuperarea
e `sincronizeazaConcediile` — vezi [[modul/concedii]].
