---
tip: modul
titlu: Mentenanță — rute, porți și navigare
aliases: [rute mentenanta, porti mentenanta, casete mentenanta, eticheta QR utilaj, scanare QR]
cai:
  - "src/app/(app)/mentenanta/**"
  - "src/app/(scanare)/mentenanta/**"
tabele:
  [
    equipment,
    equipment_meters,
    maintenance_plans,
    maintenance_interventions,
    fault_reports,
    iscir_authorizations,
  ]
permisiuni: [maintenance:read, maintenance:create, maintenance:update, maintenance:export]
feature: maintenance
capcane: []
citeste_daca:
  - "un buton, o filă sau o casetă nu apare rolului care ar trebui s-o vadă → tabelul de rute"
  - "un cod QR scanat pe utilaj duce în locul greșit → paragraful despre `(scanare)`"
  - "o cifră din panou duce la o listă cu alte rânduri → ultimul paragraf"
scris_pe: c1ad3b039681d8b4d5f1f466c0c2a4e7f3ab67f8
scris_la: 2026-10-24
tags: [modul]
---

# Mentenanță — rute, porți și navigare

Secțiune extrasă din [[modul/mentenanta]], ca pagina principală să rămână sub plafon:
rutele modulului cu poarta fiecăreia, banda de file, casetele de creare, adresa tipărită
pe autocolantele QR și panoul.

## Rute și cine ajunge

| Rută                                                       | Poartă                    |
| ---------------------------------------------------------- | ------------------------- |
| `/mentenanta`                                              | `maintenance:read` own    |
| `/mentenanta/sesizari`, `/mentenanta/sesizari/[id]`        | `maintenance:read` own    |
| `/mentenanta/sesizari?sesizare=noua` (casetă)              | `maintenance:create` own  |
| `/mentenanta/echipamente`, `/mentenanta/echipamente/[id]`  | `maintenance:read` team   |
| `/mentenanta/echipamente?echipament=nou` (casetă)          | `maintenance:update` team |
| `/mentenanta/planuri`, `/mentenanta/planuri/[id]`          | `maintenance:read` team   |
| `/mentenanta/interventii`, `/mentenanta/interventii/[id]`  | `maintenance:read` team   |
| `/mentenanta/interventii?interventie=noua` (casetă)        | `maintenance:update` team |
| `/mentenanta/contoare`, `/mentenanta/echipamente/etichete` | `maintenance:read` team   |
| `/mentenanta/iscir`                                        | `maintenance:read` team   |
| `/mentenanta/rapoarte` (perioadă, CSV `export` team)       | `maintenance:read` team   |
| `/mentenanta/setari`                                       | `maintenance:update` all  |

Pragul `own` pe panou și pe sesizări e intenționat: **oricine poate sesiza o defecțiune**.
Restul modulului — parcul de echipamente, planurile, intervențiile — cere `team`. Butoanele
„Sesizare nouă” (panou, „Sesizările mele”, fișa echipamentului) se păzesc pe
`maintenance:create`, nu mai apar necondiționat.

Banda de file e `FileModul` cu `FILE_MENTENANTA` (`src/config/file-module.ts`), filtrată
prin poarta rutei-ȚINTĂ (`poateDeschide`): „Setări” apare exact cui i se deschide
`/mentenanta/setari`. Vezi [[strat/navigare]].

Cele două formulare de creare sunt CASETE pe listele lor (`FormularDialog`, tiparul
`?vehicul=nou` din [[modul/flota]]), nu pagini; butonul care le deschide se păzește pe
permisiunea pe care o exercită. `?echipament=nou&model=<id>` precompletează caseta din
altă fișă, fără cod și serie („Adaugă unul la fel”).

**`/mentenanta/sesizari/noua` și `/portal/sesizari/noua` există doar ca REDIRECTURI** spre
listă cu `?sesizare=noua`, păstrând `?echipament=`: autocolantele QR lipite pe utilaje codifică
adresa veche (`echipamente/eticheta-qr.tsx`). Prima stă în grupul de rute `(scanare)`, în afara
învelișului `(app)`, și **alege singură lista după rol** — `/portal/sesizari` pentru
`employee`, altfel `/mentenanta/sesizari`. Până atunci învelișul `(app)` trimitea orice
`employee` pe `/portal`, fără cale și fără interogare (un layout nu vede adresa cerută): omul
cu mănuși ajungea pe „Acasă", cu utilajul pierdut. N-are poartă proprie în
`src/config/porti-ruta.ts` — poarta e a casetei de pe lista-țintă. Echipamentul din QR se
rezolvă pe server (`cautaEchipament`), vine cu `sesizare_deschisa` pentru avertismentul de
duplicat, iar un id stricat ori un utilaj casat dau o bandă de atenție în casetă, nu 404.
`/mentenanta/echipamente/nou` a fost șters.

Pe `/mentenanta` poarta se citește de două ori: `own` deschide pagina, `team` decide dacă
se vede panoul de organizație sau doar `SesizarileMele`. Cifrele panoului (`Indicator`, din
M8) duc la listele cu EXACT rândurile numărate (`/mentenanta/planuri?scadenta=actiune`,
`/mentenanta/sesizari?deschise=da`, `/mentenanta/iscir?stare=actiune`). Din M7 panoul
are și „Verificări legale scadente” și alerta „Lipsește responsabilul RSVTI” (cazul 41).
