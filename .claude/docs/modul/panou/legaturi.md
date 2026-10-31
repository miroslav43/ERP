---
tip: modul
titlu: Panou — cifrele și unde duc
aliases: [panou-legaturi, panou-pornire, panou-praguri]
cai:
  - "src/app/(app)/panou/**"
  - "src/lib/navigation/build-navigation.ts"
tabele: []
permisiuni: [organizations:update, employees:create, departments:create]
capcane: []
scris_pe: a67bb3cc1be0a37072b4d1bb96fb262cf8338586
scris_la: 2026-10-31
tags: [modul]
---

# Panou — cifrele și unde duc

Secțiune extrasă din [[modul/panou]]: ce adresă poartă fiecare rând și fiecare cartelă, din
ce prag se numără, blocul „Pornire" și intrările de meniu de rezervă. Porțile contorilor,
cifra din antet și restul lui „Ce refuză baza tăcut" rămân în trunchi.

## Fiecare link poartă filtrul numărătorii

Un rând sau o cartelă duce la lista care conține EXACT rândurile numărate, nu la modulul
din care vin: `/reges?stare=de_transmis`, `/ticketing/coada?status=in_aprobare`,
`/flota/rezervari?stare=ceruta`, `/flota?conformitate=expira`, `/flota?conformitate=lipsa`,
`/angajati?contract=expira`, `/onboarding/sarcinile-mele`. Fără parametru, omul apăsa pe
cifră și primea registrul întreg, din care trebuia să deducă singur care rânduri fuseseră
numărate.

Cifrele din „Firma azi" sunt linkuri doar dacă `poateDeschide` (`src/config/porti-ruta.ts`)
trece pe ruta ȚINTĂ; altfel rămân text, nu refuz. „În concediu" e singura care nu se poate
alinia: contorul include fișa proprie, iar `/concedii/echipa` o exclude prin construcție,
deci lista poate avea cu un rând mai puțin decât cifra. Stratul, întreg:
[[strat/navigare]].

## Blocul „Pornire" se arată doar cui poate apăsa

`arataPornire` cere firma goală ȘI cel puțin unul dintre `organizations:update`,
`employees:create`, `departments:create`, toate la `all`. Fiecare pas își primește butonul
tot pe poarta ȚINTEI, nu a panoului: `hr` n-are `organizations:*`, managerul n-are
`departments:*`, iar înainte amândoi vedeau o listă de pași cu butoane care duceau în
`AccesRestricționat` (ONB-032). Un pas fără drept rămâne pas, fără acțiune.

## Ce refuză baza tăcut

- **O intrare de meniu la care ai drept poate totuși să nu apară.** `buildNavigation`
  retrage intrările de REZERVĂ: cea care declară `doarFara` se ascunde când intrarea numită
  acolo e vizibilă (`flota-foi` cedează lui `flota`). Absența unei intrări nu mai înseamnă
  neapărat lipsa dreptului, deci nu se mai diagnostichează doar pe permisiuni. — `a67bb3c`

## Când NU e suficientă pagina asta

- Porțile contorilor și cifra din antet: [[modul/panou]].
- Registrul porților de rută, pe care se judecă fiecare link: [[strat/navigare]].
