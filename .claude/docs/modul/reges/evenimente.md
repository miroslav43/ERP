---
tip: modul
titlu: REGES — cum apar evenimentele și cu ce termen
cai:
  - "src/lib/reges/genereaza-evenimente.ts"
  - "src/domain/reges/evenimente.ts"
  - "src/domain/reges/absente.ts"
  - "src/domain/reges/plan.ts"
  - "supabase/migrations/0128_absente_nemotivate_suspendare.sql"
tabele: [reges_evenimente, reges_termene, contract_suspendari, notifications, organization_features]
permisiuni: []
feature: reges
capcane: []
scris_pe: a67bb3cc1be0a37072b4d1bb96fb262cf8338586
scris_la: 2026-10-31
tags: [modul, hr]
---

# REGES — cum apar evenimentele și cu ce termen

Secțiune extrasă din [[modul/reges]]: de unde vine un rând în registru, cine e anunțat și
cum se calculează termenul de transmitere.

## Evenimentul nou își anunță singur transmițătorul

`genereazaEvenimenteReges` (`src/lib/reges/genereaza-evenimente.ts`) e chemată de
[[modul/angajati]], [[modul/concedii]] și [[modul/pontaj]] după ce își scriu ele rândul;
transmiterea rămâne manuală, deci altfel evenimentul ar aștepta tăcut, cu termenul curgând,
într-un modul pe care nimeni n-are motiv să-l deschidă în ziua aceea. După INSERT,
`anuntaDeTransmis` scrie câte un rând în `notifications` — `kind = "task"`, link
`/reges?stare=de_transmis` (coada pe care anunțul o numără, nu rădăcina modulului), cu
numărul evenimentelor și cel mai apropiat termen din lot, formatat zz.ll.aaaa ca în restul
aplicației — pentru membrii activi cu rol `org_admin` sau `hr`. Lista
(`ROLURI_CARE_TRANSMIT`) e scrisă în cod, nu citită din `role_permissions`: o firmă care
strânge cheia dintr-un rând propriu primește cel mult un anunț în plus, niciodată un drept.
`super_admin` nu primește nimic — n-are rând în `organization_members`.

Evenimentele se scriu **și** la firmele cu modulul oprit (contractul s-a schimbat, registrul
trebuie să-l știe), dar anunțul nu: `anuntaDeTransmis` verifică întâi `organization_features`
și tace fără modul, altfel linkul ar fi dus într-un ecran refuzat de `requireFeature`.

Două tăceri: funcția **nu aruncă**, fiindcă evenimentul e deja scris când se ajunge acolo —
un anunț pierdut se vede doar în log, nu în ecran; iar evenimentele deduplicate (`sarite`)
nu produc anunț, se anunță doar lotul chiar inserat.

## Termenul se numără cu sărbătorile în vigoare la acea dată

`sarbatoriLegale` (`src/domain/reges/evenimente.ts`) nu aplică retroactiv lista de azi:
sărbătorile intrate prin modificări ale art. 139 (24 ianuarie, 1 iunie, Vinerea Mare,
6 și 7 ianuarie) apar doar din ziua de la care sunt în vigoare, fiindcă un termen recalculat
pe un eveniment vechi ar fi ieșit cu o zi liberă care atunci nu exista. Garanția începe cu 2017. Lista e scrisă a doua oară, deliberat, în `src/domain/calendar/sarbatori.ts`; testul
cere ca cele două să coincidă an de an.

## Absențele nemotivate — al doilea drum către o suspendare

`0128` a adăugat `suspendare_nemotivata` și `reluare_nemotivata` în `reges_tip_eveniment`.
**Nu sunt operații noi de protocol** — `plan.ts` le mapează la `SuspendareContract` și
`ReactivareContract`, ca surorile lor. Diferența e despre **termen**, iar `reges_termene` are
un rând per `event_type`: nu încap două sub aceeași cheie. Rândurile de platformă din `0128`
dau 3 zile lucrătoare **de la** suspendare (absența nu poate fi anunțată în ziua anterioară)
și **zero** zile la reluare, ca întoarcerea neanunțată să nu apară ca întârziere.

Detecția e `seriiDeAbsente` din `src/domain/reges/absente.ts`, modul pur. „Consecutiv" NU
înseamnă zile calendaristice la rând: weekendul și sărbătoarea nelucrate lasă seria deschisă,
iar o zi în care omul a **făcut** ceva (a lucrat, concediu, medical) o rupe — de aceea
funcția primește toate zilele lunii, nu doar absențele. Pragul, `PRAG_ZILE_ALERTA`, stă în
cod: e convenție de produs, nu regulă legală.

Aplicația **semnalează**, nu suspendă singură — emiterea e decizie de om, în
`src/app/(app)/pontaj/suspendare-absente.ts` (v. [[modul/pontaj]]). Suspendarea se deschide
cu `data_sfarsit` NULL și se închide când pontajul primește ore lucrate;
`contract_suspendari.sursa` (`manuala` | `concediu` | `absenta_nemotivata`) dă detecției de
conflict un predicat în loc de text liber, iar o suspendare suprapusă cade pe
`contract_suspendari_fara_suprapunere` cu **23P01**.
