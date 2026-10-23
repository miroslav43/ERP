---
tip: modul
titlu: Flotă — foaia zilnică, plafoanele, gărzile și paritatea stării
aliases: [plafoane foaie, foaia numerotata, paritatea starii, gărzi foaie, foi_parcurs_inainte]
cai:
  - "supabase/migrations/0200_flota_foaia_zilnica.sql"
  - "supabase/migrations/0226_securitate_reziduala.sql"
  - "tests/rls/proba-flota-plafoane.sql"
  - "tests/rls/proba-flota-stare-foii.sql"
tabele: [trip_sheets, trip_sheet_curse, trip_route_templates, fuel_entries, registru_documente]
permisiuni: [trip_sheets:read, trip_sheets:update]
feature: fleet
capcane: []
scris_pe: 51d9f365e9618a5c1ac95a1a527079d009ab4972
scris_la: 2026-10-23
tags: [modul, operations]
---

# Flotă — foaia zilnică: plafoanele, gărzile și paritatea stării

Secțiuni extrase din [[modul/flota/foaia-zilnica]] (pagina trecuse de plafonul dur al
convenției vault-ului): ce refuză baza pe foaie, pe curse și pe alimentări. Modelul foii,
acțiunile, ecranele și PDF-ul rămân acolo; pagina de modul e [[modul/flota]].

## Plafoane, suprapuneri, foaia numerotată (0200 §E, revizia A2)

Reproduse pe banc ca `employee` înainte de reparare; proba e `proba-flota-plafoane.sql`.

- **Plafoane, P0001, pentru orice scriitor** (și contextul de serviciu): cel mult 40 de
  curse active pe foaie (o zi de 12 ore, o cursă la 18 minute), 20 de alimentări pe foaie
  (bugetul lui `combustibilPeFoi`) și 100 de șabloane active pe firmă (`PLAFON_SABLOANE`:
  cele două cifre se schimbă împreună). Cursa și alimentarea blochează rândul foii
  (`for no key update`) înainte de numărătoare, deci plafonul ține și sub concurență.
  Rândurile șterse nu se numără: ștergerea eliberează locul.
- **`ordine`**: cursa nouă își ia poziția exactă la inserare; `curse_dupa` renumerotează
  doar la oră mutată sau cursă ștearsă și scrie doar rândurile care se mută (fiecare = un
  rând de audit).
- **Suprapunerea se judecă față de foile declarate** (`trimis`/`aprobat`), nu față de
  ciorne: o ciornă rătăcită nu blochează ziua reală, două ciorne suprapuse se scriu
  amândouă, prima trimisă câștigă. La cursă e doar răspunsul imediat, cu foaia numită
  („…de pe foaia FP-… (trimisă), de la … la …”); poarta autoritară e draft → trimis
  („Foaia nu se poate trimite: …”), serializată pe șofer cu un lacăt de tranzacție, și
  închide ocolirea respins → ciornă → trimis. Ambele interogări merg pe
  `ts_sofer_interval_gist`; înainte, o scanare secvențială a curselor tuturor firmelor.
- **Foaia numerotată e document emis.** Scriitorul `own` n-o mai șterge („Foaia are deja
  numărul …; o poate anula doar administratorul flotei.”), iar vehiculul, șoferul și ziua
  ei nu se mai schimbă, nici retrasă și golită de curse. Cine are `trip_sheets:update = all`
  o anulează (ciornă) sau o stornează (aprobată); `zz_trip_sheets_registru_anulare` pune
  atunci `anulat_la` și motivul pe rândul din registru (tiparul 0158). Pe un exercițiu
  închis, anularea foii e respinsă întreagă. Ciorna fără număr se șterge și se mută ca
  înainte.
- **Numere fără document**: niciunul pe drumurile normale. Retrimiterea păstrează numărul,
  registrul e idempotent pe entitate, iar o trimitere căzută derulează și contorul
  (`document_sequences` e tabelă). Golurile rămase sunt cele explicate în registru.
  `aloca_numar_foaie` sare și peste numărul unei foi anulate (`ts_org_numar_idx`), deci
  un contor dat înapoi de `org_admin` nu-l mai redă (§E5).
- **Cine nu scrie foaia nu află nimic din ea** (§E5). `curse_inainte` și
  `alimentari_inainte` sunt DEFINER și rulează înaintea WITH CHECK-ului de INSERT, deci
  primul lucru după citirea foii e `poate_scrie_foaie`, cu 42501 (afișat generic). Înainte,
  un coleg sau un utilizator din altă firmă care știa id-ul afla din P0001 ziua, orele și
  starea foii și numărul foilor declarate ale șoferului.

## Gărzile X2 (0200, pe loc)

- **Garda de firmă vine prima** în `foi_parcurs_inainte`: un BEFORE ROW rulează înaintea
  `WITH CHECK`, deci un rând pus pe o firmă străină ajungea la mesajul de regres și afla
  kilometrajul vehiculului ei. Acum: 42501 neutru, înaintea oricărei căutări.
- **Cifra din mesajul de regres** (km-ul vehiculului) o primește doar cine vede vehiculul
  (`app.poate_vedea_vehicul`); restul (hr, șoferul pe o mașină care nu mai e a lui) primește
  același refuz fără cifră, pe `km_plecare`.
- **Plafonul de 100 de șabloane e sub lacăt** (`pg_advisory_xact_lock` pe firmă): fără el,
  două inserări simultane la 99 treceau amândouă (101, măsurat pe banc). Garda de firmă
  vine și aici înaintea lacătului: de pe altă firmă, 42501, nu plafonul victimei.
- **`foi_select` are ramura `is_platform_admin`** (0226): super_admin vedea zero foi.

## Paritatea stării (0200 §D, din revizia de securitate pe 20776502)

În afara contextului de serviciu, PE ORICE SCOPE (și `org_admin`):

| Stare     | Ce se mai mișcă                                                          |
| --------- | ------------------------------------------------------------------------ |
| `draft`   | tot: antetul, cursele, alimentările, ștergerea logică, trimiterea        |
| `trimis`  | doar retragerea → `draft` (nicio altă coloană) sau decizia aprobatorului |
| `respins` | doar redeschiderea → `draft`                                             |
| `aprobat` | doar stornarea (`deleted_at`), sub `trip_sheets:update = all`            |

Cursele și alimentările urmează EXACT starea foii: se adaugă, se modifică și se șterg doar
pe ciornă. Înainte, pe o foaie trimisă șoferul își schimba alimentările, iar `org_admin`
kilometrii, în timp ce aprobatorul se uita la ele. **Ștergerea logică e ireversibilă** pe
foi, curse și alimentări: readucerea `deleted_at` la null dă P0001 (foaia) sau zero rânduri
(`USING deleted_at is null`, la curse și alimentări). Verificarea de regres a
kilometrajului rămâne la întocmire și la draft → trimis, iar nicio cale nu mai schimbă km pe
o foaie ne-ciornă.
