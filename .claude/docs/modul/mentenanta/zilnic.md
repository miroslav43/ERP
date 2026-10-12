---
tip: modul
titlu: Mentenanță — jobul zilnic și rezumatul de dimineață
aliases: [mentenanta-zilnica, rezumat mentenanta, alerte mentenanta, praguri alerta]
cai:
  - "supabase/migrations/0191_mentenanta_zilnica.sql"
  - "src/domain/maintenance/praguri.ts"
  - "src/app/(app)/mentenanta/setari/**"
  - "tests/rls/proba-mentenanta-zilnica.sql"
tabele: [maintenance_rezumat_trimis, maintenance_settings, alert_rules, alert_notifications]
permisiuni: [maintenance:read, maintenance:update]
feature: maintenance
capcane: [7, 17, 39]
citeste_daca:
  - "cineva nu primește rezumatul, îl primește dublat sau vede ceva ce nu-i aparține → „Cine primește ce”"
  - "pragurile salvate în setări nu schimbă alertele → „Ce refuză baza tăcut”"
  - "fișiere rămase în bucket fără rând → „Curățarea încărcărilor”"
scris_pe: af0af97b541c0f50b65218aae6a77545406acbc7
scris_la: 2026-10-12
tags: [modul, operations]
---

# Mentenanță — jobul zilnic

Extrasă din [[modul/mentenanta]]. Din `0191`, `internal.mentenanta_zilnica()` rulează prin
`pg_cron` (`mentenanta-zilnica`, `10 5 * * *`, adică ora UTC — dimineața în România) și, pe
fiecare firmă activă cu modulul pornit, face trei lucruri în ordine:

1. `internal.genereaza_alerte(org)` — aceeași funcție pe care o cheamă jobul de
   conformitate al Flotei; idempotentă prin `on conflict`, deci două joburi nu dublează.
2. `internal.mentenanta_rezumat(org)` — **o singură notificare per destinatar**, cu
   `entity_type = 'maintenance_rezumat'`, titlul numărat („Mentenanța de azi: 1 sesizare
   critică fără tehnician, 2 scadențe apropiate.”) și primele opt elemente în corp.
3. `internal.sesizari_inchide_rezolvate(org)` — „rezolvat” neconfirmat după
   `inchidere_automata_zile` devine „închis”; garda din `0181` scrie în istoric
   „Închisă automat…”.

Fiecare firmă rulează în subtranzacția ei: o eroare pe una dă `warning` și se numără în
`firme_esuate` din raportul jobului, fără să le oprească pe celelalte. Firma suspendată,
arhivată, cu abonamentul `canceled`/`expired` sau cu `maintenance` oprit e sărită.

## Ce intră în rezumat

| Element                         | Sursa                                                                                 | Cine îl primește în afara gestionarilor                  |
| ------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| scadență apropiată / depășită   | `compliance_alerts` pe `maintenance_plan`, `iscir_authorization`, `equipment`         | responsabilul planului, al utilajului; RSVTI-ul la ISCIR |
| plan pe contor la țintă         | ultima citire față de `urmatoarea_scadenta_contor` (regula din `stareScadentaContor`) | responsabilul planului și al utilajului                  |
| contor necitit                  | utilaj cu plan activ pe contor, fără citire de `prag_contor_necitit_zile`             | responsabilul utilajului                                 |
| sesizare critică fără tehnician | `urgenta = 'critica'`, neatribuită, raportată de peste 24 h                           | nimeni — doar gestionarii                                |
| oprire de peste 3 zile          | `equipment_opriri` deschisă, fără intervenție legată                                  | responsabilul utilajului                                 |

Utilajele casate, în conservare sau șterse nu produc elemente pe contor; ISCIR-ul în
conservare rămâne, ca în `0182`.

## Cine primește ce

**Gestionarii** sunt `internal.mentenanta_responsabili(org)`: fișele bifate în setări,
iar fără ele toți `org_admin` activi. Ei primesc tot. Ceilalți primesc **doar** elementele
legate de planurile și utilajele lor — un coleg fără legătură nu primește nimic. Linkul
e `/mentenanta` pentru cine are `maintenance:read` ≥ team (citit prin
`internal.scope_membru`, cu suprascrierile pe membru din `0189`) și `/portal/sesizari`
(„Echipamentele în grija mea”) pentru ceilalți: un `employee` n-ar putea deschide panoul.

## Ce refuză baza tăcut

- **Același element nu se repetă.** Alertele cu `compliance_alerts` se marchează în
  `alert_notifications` (`canal = 'in_app'`, cheia pe utilizator); celelalte în
  `maintenance_rezumat_trimis`, unde un element trimis cuiva tace 7 zile. A doua rulare
  din aceeași zi nu scrie nimic. Planul cerea verificarea pe `notifications`, dar
  rezumatul e unul singur per om și nu are pe ce lega elementele.
- **Registrul e al jobului.** Politicile de INSERT și UPDATE cer `app.is_service_context()`
  — un utilizator nu-și poate scrie singur „deja trimis” (42501); SELECT arată fiecăruia
  doar rândurile lui. Fără `attach_audit`, ca la `alert_notifications`: e proiecție de mașină.
- **Pragurile nu se scriu în `alert_rules` din aplicație.** Politica ei cere
  `compliance:*`; triggerul `maintenance_settings_praguri` (definer) le oglindește pe cele
  trei `entity_type` ale modulului, o versiune pe zi (a doua salvare din zi o rescrie).
  Dreptul real e cel al setărilor: `maintenance:update = all`, deci doar `org_admin` —
  managerul atinge zero rânduri. Un `super_admin` atinge și el zero: politica de UPDATE
  din `0181` n-are ramură de platformă. — capcana #17
- **Nu se cheamă `internal.curata_alerte`**: lucrează pe toată firma și ar închide alertele
  Flotei din jobul altui modul.

## Curățarea încărcărilor

Jobul **nu** șterge fișiere: un `delete` pe `storage.objects` scoate doar metadatele,
iar `pg_net` nu e activat. Curățarea o face `pregatesteFisier`
(`mentenanta/sesizari/actions.ts`), după ce semnarea pe clientul utilizatorului a
trecut: listează folderul entității prin clientul admin și șterge prin API obiectele mai
vechi de 24 h fără rând în `maintenance_attachments` (rândurile șterse logic țin
obiectul în viață). Orice eroare e înghițită. Un orfan pe o entitate la care nu se mai
încarcă nimic rămâne până la următoarea încărcare acolo.

## Setări

`/mentenanta/setari`, secțiunea „Rezumatul zilnic”: câmpul de praguri primește text
(„30, 14, 7”), tăiat de `bucatiPraguri` și validat de `setariMentenantaSchema` — 1–8
valori, fiecare 1–365 zile, normalizate descrescător (`normalizeazaPraguri`), aceleași
limite ca `maintenance_settings_praguri_ck`. Fișierul `"use server"` nu exportă
constanta de vârstă a orfanilor (capcana #39).

## Când NU e suficientă pagina asta

- Verificările pe roluri și idempotența: `tests/rls/proba-mentenanta-zilnica.sql`; scrierea
  legitimă a pragurilor: blocul (l) M9 din `tests/rls/izolare.sql`.
- Contractul acțiunilor: `sesizari/actions.test.ts` (praguri, curățarea orfanilor).
- Programarea pe producție depinde de `pg_cron`; fără extensie, migrarea doar anunță.
