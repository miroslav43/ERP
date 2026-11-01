---
tip: modul
titlu: Mentenanță — ciclul de viață al echipamentului — fișa și etichetele
aliases: [fisa-echipament, etichete QR, documente echipament]
cai:
  - "src/app/(app)/mentenanta/echipamente/**"
  - "supabase/migrations/0182_echipamente_ciclu.sql"
tabele:
  [
    equipment,
    maintenance_attachments,
    maintenance_plans,
    iscir_authorizations,
    puncte_lucru,
    fault_reports,
  ]
permisiuni:
  [maintenance:read, maintenance:create, maintenance:update, departments:read, ssm:read, audit:read]
feature: maintenance
capcane: []
scris_pe: c78f84c1a25c63c9490dcfe8104b51bf51aff507
scris_la: 2026-11-01
tags: [modul, operations]
---

# Mentenanță — ciclul de viață al echipamentului — fișa și etichetele

Secțiune extrasă din [[modul/mentenanta/echipamente]]: corpul paginii-mamă se apropia de
plafonul dur, iar fișa e navigație — ce link apare, ce rămâne pe ecran, ce se tipărește.

## Fișa unui utilaj

Pe fișa unui utilaj `casat` toate formularele dispar (`poateScrie && !casat`): rămân
datele, istoricul, documentele și eticheta. Se redeschide doar cu „Schimbă starea”.

Drumurile dinspre fișă se decid PER RÂND, nu pe pagină. Numele celui care a citit
contorul, al executantului și al responsabilului de plan devin link prin
`hrefFisaDinHarta`: absența din harta `angajatiDupaId` înseamnă rând ascuns de RLS, deci
nume fără link. Punctul de lucru duce la `/puncte-lucru` și la celelalte echipamente ale
locației doar cu `departments:read`, tipul de autorizare ISCIR la `/ssm/autorizatii` doar
cu modulul `ssm` și `ssm:read` team, iar „Istoricul modificărilor”
(`src/components/audit/istoric-modificari.tsx`) nu randează nimic fără poarta lui
`/setari/audit` — fiecare prin `poateDeschide()`, nu prin booleeni scriși aici. Banda de
file e cea a modulului, nu un `nav-mentenanta` cu booleeni proprii: [[modul/mentenanta]].

Intervențiile și sesizările legate sunt citite cu `limita: 50`, deci au fiecare un „vezi
toate” spre lista proprie filtrată pe utilaj (`?echipament=<id>`). „Sesizare nouă” pe
antetul fișei cere `maintenance:create` own. Planul nou salvat deschide fișa lui
(`laReusita` → `/mentenanta/planuri/[id]`), ca echipamentul nou.

Secțiunea „Documente” a fișei ține cartea tehnică, certificatul CE și manualul în
`maintenance_attachments` (bucket privat, URL-uri semnate scurt de `urlSemnate`);
încărcarea și ștergerea cer `update` team.

## Eticheta QR

Eticheta QR codifică `/mentenanta/sesizari/noua?echipament=<id>` — forma autocolantelor
deja lipite, păstrată ca redirect. Pe utilajele „folosite în afara sediului” eticheta
poartă ultima verificare legală și scadența (planul `verificare_legala`), fără nume de
persoane: HG 1146 cere dovada, nu identitatea. Tipărirea în lot ia lista filtrată sau o
selecție explicită (`?ids=a,b,c`); peste `MAXIM_ETICHETE` spune că a tăiat, iar din lista
filtrată scoate casatele (din `?ids=` nu).

## Când NU e suficientă pagina asta

- Ce refuză baza la casare, ștergere și părinte: [[modul/mentenanta/echipamente]].
- Sesizarea ca flux (tehnician, opriri): [[modul/mentenanta/sesizari]].
