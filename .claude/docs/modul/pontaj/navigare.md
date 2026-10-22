---
tip: modul
titlu: Pontaj — unde duce fiecare nume
aliases: [pontaj-navigare, pontaj-linkuri]
cai:
  - "src/app/(app)/pontaj/page.tsx"
  - "src/app/(app)/pontaj/foaie-colectiva.tsx"
  - "src/app/(app)/pontaj/celula-zi.tsx"
  - "src/app/(app)/pontaj/sectiune-saptamana.tsx"
  - "src/app/(app)/pontaj/alerta-absente.tsx"
  - "src/app/(app)/pontaj/anunta-respingerea.ts"
  - "src/app/(app)/pontaj/aprobare/**"
  - "src/app/(app)/pontaj/perioade/**"
  - "src/app/(app)/pontaj/arhiva/**"
  - "src/domain/attendance/saptamana.ts"
  - "src/config/porti-ruta.ts"
  - "src/config/file-module.ts"
tabele: [attendance_entries, attendance_periods, attendance_approval_batches]
permisiuni: [employees:read, leave:read, attendance:approve, departments:read]
feature: attendance
capcane: []
scris_pe: bd516e390b0ca4dbe758079da30184b7288ceeb5
scris_la: 2026-10-12
tags: [modul, hr]
---

# Pontaj — unde duce fiecare nume

Linkurile pe care le pun ecranele pontajului și poarta pe care o cere fiecare. Trunchiul
e [[modul/pontaj]].

## Linkurile, cu poarta paginii-țintă

Regula e a stratului, nu a modulului: **un link trece prin poarta paginii-ȚINTĂ**
(`poateDeschide`, din registrul porților de rută), iar numele unei entități devine link
PER RÂND (`LinkEntitate`, `hrefFisa`) — [[strat/navigare]]. Ce e al pontajului:

| De pe ecran                                       | Unde duce, cu ce poartă                                                                                                                                                                                        |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| nume, în foaie / calendar / avertismente / loturi | `/angajati/<id>` — `employees:read` nenul                                                                                                                                                                      |
| „Zile speciale" din foaie                         | cererile omului, pe intervalul foii: rândul propriu la `/concedii?vedere=cereri&de_la=&pana_la=` (poarta lui `/concedii`), al altuia la `/concedii/echipa?employee_id=…` (modulul `leave` + `leave:read` team) |
| celulă completată din concediu                    | `/concedii/<leaveRequestId>` — id-ul e nou pe `IntrareZiClient`, lângă `esteDinConcediu`                                                                                                                       |
| celulă „așteaptă decizia", pe foaie read-only     | `/pontaj/aprobare?an=&luna=` — doar pentru cine NU poate edita dar aprobă, adică managerul din 0161                                                                                                            |
| banda „perioada este blocată"                     | `/pontaj/perioade?an=`                                                                                                                                                                                         |
| sediul SCANAT, din dialogul zilei                 | `/puncte-lucru?punct=&#punct-`, în fereastră NOUĂ: celula e un dialog modal, o navigare în loc l-ar închide. `SediuPontaj.href` îl pune pagina, doar cu `departments:read`                                     |
| luna, din `/pontaj/perioade` și din arhivă        | foaia ei, `/pontaj?an=&luna=`; „loturile" rămâne al doilea link, doar unde există rând în `attendance_periods`                                                                                                 |
| numărul de înregistrare al arhivei                | `/registru?an=&doc=<registruDocId>` — `registru_documente.id`, nou lângă `numarAfisat`                                                                                                                         |
| detaliul perioadei                                | `/salarizare/<id>` al statului calculat peste pontajul ăsta (`perioadaSalarizariiPentruPontaj`), foaia, arhiva și fișa managerului care a aprobat lotul                                                        |

## Porțile care nu sunt cele evidente

Două porți care nu sunt cele evidente: `hr` are `attendance:read = all` dar
`approve = none`, deci tot ce duce în `/pontaj/aprobare` din detaliul perioadei trece prin
`file.poateAproba` (permisiunea ȘI alegerea firmei, 0118) — altfel îl trimitea în refuz; iar
fila **Coduri QR** se stinge singură, fiindcă `FileModul` filtrează `FILE_SETARI_PONTAJ`
(`src/config/file-module.ts`) prin poarta FIECĂREI file. `NavSetariPontaj` nu mai există, și
nici condițiile scrise de mână în cele trei pagini de setări.

## Filtrul de intrare `?angajat=`

`?angajat=<uuid>` e filtru de INTRARE: validat în `filtrePontajSchema`, aplicat în
`listeazaAngajatiPontaj`, cu pastilă prin `cheiExterne` (n-are câmp în bară) și numele citit
cu `angajatiPontajDupaId`. Intră prin el salarizarea, diurna, rapoartele, fișa angajatului,
profilul și notificările, deci lista lui goală se citește „filtrată", nu „pustie".

## După o scriere: toast cu acțiune

După o scriere care golește ecranul, mesajul e un toast CU ACȚIUNE: aprobarea în bloc spune
câte linii au intrat (`liniiAprobate`) și duce la lotul evidențiat, `?lot=<id>#lot-<id>`,
aprins pe SERVER fiindcă `:target` nu se aprinde după o navigare din client. Când ținta nu se
deschide pentru rol, textul pleacă cu `fel: "eroare"` (alerta de absențe, fără `/reges`):
un toast cu acțiune sau de eroare nu se stinge singur, iar termenul de transmitere nu trebuie
să dispară de pe ecran în șase secunde.

## Ziua blocată și ziua respinsă

Ziua blocată din grila săptămânii e și ea un drum (`hrefBlocare`): concediul care a scris-o,
ori fișa săptămânii în varianta `saptamanal`; motivul intră în numele accesibil, fiindcă în
`title` era invizibil la atingere și la tastatură. Mementoul de săptămână lipsă (0166) numește
ziua doar în CORPUL notificării — `ziuaRomaneascaDinText` (`domain/attendance/saptamana.ts`)
o scoate, ca linkul să deschidă săptămâna numită, nu implicita ecranului. Respingerea unei
zile duce la ZIUA de corectat, `/portal/pontajul-meu/zi/<data>` (`anuntaRespingereaZilei`),
nu la luna ei.
