---
tip: modul
titlu: SSM și PSI — de ce nicio instruire periodică nu se putea salva (0021)
cai:
  - "src/app/(app)/ssm/instruiri/**"
  - "supabase/migrations/0021_fix_instruiri_ssm.sql"
tabele: [ssm_trainings, ssm_training_types, ssm_training_type_periods]
permisiuni: [ssm:read, ssm:create]
capcane: []
scris_pe: c78f84c1a25c63c9490dcfe8104b51bf51aff507
scris_la: 2026-11-01
tags: [modul, hr]
---

Secțiune extrasă din [[modul/ssm]]: defectul care făcea ca exact instruirea periodică —
cazul obișnuit, cel cerut de ITM la control — să nu se poată salva, și cum a trecut pe
lângă toate porțile.

## De ce nicio instruire periodică nu se putea salva (0021)

`internal.ssm_training_sync()` compunea cheia scadenței ca `domeniu || ':' || cod` —
`ssm:periodic` — și o trimitea în `public.expirables`, unde constrângerea `expirables_kind_ck`
acceptă `^[a-z][a-z0-9_]{1,48}$`. Tiparul nu are două puncte. Deci exact cazul obișnuit —
instruirea periodică, cea cerută de ITM la control — pica la salvare cu 23514, pentru
oricine. Tipurile fără periodicitate treceau, fiindcă nu produc scadență, iar asta făcea
defectul să pară intermitent.

`0021_fix_instruiri_ssm.sql` schimbă separatorul în underscore și validează cheia în
funcție, cu mesaj propriu, înainte de a atinge tabela.

De reținut e cum a scăpat: migrarea se aplică fără eroare (constrângerea se evaluează la
INSERT, nu la crearea funcției), cele trei bariere SQL treceau, iar testul de izolare
demonstra absența accesului NEautorizat — nu prezența celui autorizat. L-a prins doar
verificarea `(l)` din `tests/rls/izolare.sql`, extinsă cu o instruire inserată ca
utilizator obișnuit.
