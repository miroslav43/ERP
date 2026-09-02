---
tip: modul
titlu: Concedii — acțiuni și citiri
aliases: [concedii-actiuni, concedii-citiri]
cai:
  - "src/app/(app)/concedii/actions.ts"
  - "src/lib/queries/leave.ts"
  - "src/schemas/leave.ts"
tabele: [leave_requests, leave_request_days, leave_balances, approval_tasks, notifications]
permisiuni: [leave:read, leave:create, leave:update, leave:approve]
feature: leave
capcane: [11, 17, 33]
scris_pe: 0815fbff2c885cd44b5768ee25f084f16a9e95b8
scris_la: 2026-09-03
tags: [modul, hr]
---

# Concedii — acțiuni și citiri

Cele șase scrieri ale cererii și cele unsprezece citiri ale ei. Ce refuză baza tăcut stă în
trunchi, [[modul/concedii]], fiindcă acolo se ajunge dintr-un bug. Configurarea firmei e
în [[modul/concedii/setari]].

## Server Actions

`src/app/(app)/concedii/actions.ts`. Cele șase scrieri de configurare stau în
`setari/actions.ts` și sunt descrise în [[modul/concedii/setari]].

| Funcție                               | Permisiune / minScope  |
| ------------------------------------- | ---------------------- |
| `creeazaCerereConcediu`               | `leave:create` / own   |
| `trimiteCerere`, `anuleazaCerere`     | `leave:update` / own   |
| `decideCerere`                        | `leave:approve` / team |
| `pregatesteIncarcareDocumentConcediu` | `leave:create` / own   |
| `linkDocumentConcediu`                | `leave:read` / own     |

`decideCerere` întoarce `{ id, zilePastrate }`, nu doar identificatorul cererii, iar
`revalidate` își declară tipul explicit pe forma asta. `zilePastrate` e numărul de zile
de concediu peste care exista deja o linie de pontaj scrisă de om — v. „Ce refuză baza
tăcut". Cine adaugă un apelant nou trebuie să-l **afișeze**: e singurul loc în care
cineva care poate repara se uită la ecran. Azi îl consumă `DecizieAprobare`
(`src/app/(app)/concedii/aprobari/decizie-aprobare.tsx`, folosită și de `/concedii/[id]`),
ca `role="alert"` care supraviețuiește închiderii panoului; în plus, acțiunea îi scrie
angajatului o notificare în `notifications`, cu clientul admin, filtrat pe organizație.
Notificarea e un plus, nu poarta: dacă INSERT-ul cade, eșecul se loghează și aprobarea
rămâne dată.

**Octeții documentului justificativ nu trec prin nicio acțiune.**
`pregatesteIncarcareDocumentConcediu` întoarce `{ cale, token }`, fișierul urcă din
browser direct în `org-documents` (`uploadToSignedUrl`), iar calea ajunge în
`creeazaCerereConcediu` printr-un câmp ascuns numit `atasament_path` — exact cheia din
`creeazaCerereSchema`, ca `fieldErrors` s-o găsească. Fișierul e sus **înainte** ca
cererea să existe: un abandon lasă un obiect orfan, preferabil unei cereri care trimite
spre un fișier inexistent. `linkDocumentConcediu` face drumul invers — citește RÂNDUL cu
clientul utilizatorului, ca RLS să decidă cine vede cererea, și abia calea din rândul
întors se semnează, pentru un minut. Componentele `incarcare-document.tsx` și
`link-document.tsx` stau în `src/app/(app)/concedii/`; prima e folosită și de formularul
din portal, deci se schimbă pentru amândouă ecranele deodată.

## Citiri

`src/lib/queries/leave.ts`: `listeazaCereri`, `citesteCerere`, `zileleCererii`,
`lantulAprobarii`, `soldAnual`, `istoricSold`, `numarDeAprobat`, `deAprobat`,
`calendarLunii`, `angajatiPlanificator`, `zileNelucratoare`. Citirile de configurare —
`configurareConcedii`, `previzualizeazaDrepturi`, `coduriIndemnizatieMedicala`,
`varianteConcediu` — sunt în [[modul/concedii/setari]].

`zileNelucratoare` e memoizată pe cerere cu `cache()` din React, ca `resolveTenant` și
`getPermissionMap` — o pagină care o cheamă din corpul ei și din secțiunea streamată
plătește un singur val. Memoizarea ține doar fiindcă argumentele sunt primitive
(`organizationId`, doi ani): `cache()` compară prin identitate, deci un argument-obiect
n-ar nimeri niciodată în cache. E consumată și din afara modulului — `[[modul/pontaj]]`,
`[[modul/salarizare]]` și portal — deci semnătura ei nu se schimbă local.

## Ce se mișcă împreună la o schimbare de formă

Forma returnată de o acțiune se mișcă în trei locuri deodată: tipul din `handler`, tipul
scris explicit în `revalidate` (declarat înaintea handlerului, deci TypeScript n-are de
unde-l infera) și componenta client care citește `rezultat.data`. `decideCerere` le are
pe toate trei.

## Când NU e suficientă pagina asta

- Ce refuză baza fără să spună, plus rutele și cine ajunge unde: [[modul/concedii]].
- Calculul zilelor lucrătoare și al drepturilor: `src/domain/leave/`.
