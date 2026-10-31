---
tip: modul
titlu: Pontaj — setările firmei
aliases: [pontaj-setari, pontare-rapida, coduri-qr]
cai:
  - "src/app/(app)/pontaj/setari/**"
  - "src/domain/attendance/pontare-rapida.ts"
  - "src/domain/attendance/limite-legale.ts"
tabele: [setari_pontare_rapida, attendance_settings, puncte_lucru]
permisiuni:
  [attendance:update, attendance:read, departments:update, departments:read, payroll:update]
feature: attendance
capcane: [7, 17]
scris_pe: a67bb3cc1be0a37072b4d1bb96fb262cf8338586
scris_la: 2026-10-31
tags: [modul, hr]
---

# Pontaj — setările firmei

Două ritmuri de scriere, deliberat despărțite. `attendance_settings` e VERSIONATĂ prin
`valabil_de_la` — o lună calculată trebuie să rămână explicabilă cu parametrii de atunci.
`setari_pontare_rapida` e un rând per firmă, rescris, fără istoric: acolo stau alegerile
OPERAȚIONALE, care n-au ce reconstitui pentru o lună trecută.

## Paginile modulului

Pagina asta ține cele două tabele, varianta de pontaj, cele două scrieri și poarta filei
„Coduri QR". Restul s-a spart pe subpagini (`.claude/docs/meta/conventii.md`).

| Pagină                                | Ce ține                                                                |
| ------------------------------------- | ---------------------------------------------------------------------- |
| [[modul/pontaj/setari/aprobarea]]     | `necesita_aprobare` și `tip_prezenta`: ce pași scoate, ce nu adaugă    |
| [[modul/pontaj/setari/formulare]]     | `Camp`, `Formular`, caseta golită, ce rămâne pe ecran după un refuz    |
| [[modul/pontaj/setari/limite-legale]] | avertismentele de dreptul muncii: coduri, severități, ce nu se acoperă |

## Pontarea rapidă are tabela ei (0115)

`setari_pontare_rapida` — **un rând per firmă, fără `valabil_de_la`**. Numele vine de la
primele trei coloane; din 0118 poartă și `necesita_aprobare`, din 0165 și `varianta_pontaj`,
deci e tabela setărilor OPERAȚIONALE de pontaj, nu doar a celor de pe telefon. Cele trei
coloane (`mod_pontare_rapida`, `verificare_pontare`, `program_start`) au plecat din
`attendance_settings`, unde stăteau într-o scriere VERSIONATĂ: pornirea unui buton de
pontare cerea reconfirmarea a optsprezece cifre de dreptul muncii și o dată de intrare în
vigoare. Coloanele vechi rămân pe loc, marcate ca înlocuite (tiparul 0082) — nu se mai
citesc din cod.

**Lipsa rândului e o stare normală**, cu implicite utile: `IMPLICIT_PONTARE_RAPIDA` din
`src/domain/attendance/pontare-rapida.ts` = `ceas` + `optional`. Implicitul din COD
decide, nu `default`-ul coloanei — două din trei firme n-aveau niciun rând de setări, iar
`oprit` din a treia era backfill de `ALTER TABLE` (0096), nealegerea nimănui. Consecință:
butonul „Am intrat" apare fără ca firma să configureze ceva.

`verificare_pontare` are **trei** valori. `optional` (0115) e cea care lipsea: afișul
pontează pentru cine îl scanează, iar butonul obișnuit rămâne. `cod_qr` înseamnă
OBLIGATORIU — butonul nu se mai desenează deloc, deci cine n-are afișul la îndemână nu
mai poate ponta.

Cine adaugă o setare operațională o pune în tabela asta, nu în `attendance_settings`, și
o trece prin `configPontareRapida` — cele cinci ecrane nu mai recompun regula fiecare cu
`?? "oprit"`.

## Varianta de pontaj, prima alegere a ecranului (0165)

`varianta_pontaj` (`0165_pontaj_varianta_saptamanala.sql`), `zilnic` sau `saptamanal`,
intră prin aceeași acțiune ca restul alegerilor operaționale. Pe ecran e PRIMA secțiune,
fiindcă le ramifică pe toate celelalte: pe `saptamanal`, „Cum se pontează", ora programului
și „Verificarea prezenței" DISPAR din formular în loc să se dezactiveze — un control mort
lângă o alegere vie se citește ca o setare care încă se aplică. Ramificat e și textul de
sub comutatorul de aprobare, în patru variante (`necesitaAprobare` × variantă), fiindcă pe
`saptamanal` el vorbește despre fișa săptămânii, nu despre zile. Ce se stinge de fapt în
restul produsului: [[modul/pontaj/varianta]].

Alegerile ascunse se PĂSTREAZĂ neatinse, ca întoarcerea pe `zilnic` să regăsească firma
cum era — de aici **cele două refuzuri care nu se arată nicăieri**:

- Verificarea de pe client e păzită de `peZi` (`formular-pontare-rapida.tsx`), dar
  `setariPontareRapidaSchema` cere în continuare `program_start` pentru `confirmare` și
  `ambele`. Cine alege `confirmare` fără oră, trece pe `saptamanal` și salvează primește
  `VALIDARE` pe `program_start` — un câmp care nu mai e desenat — iar propoziția generală
  se stinge tocmai fiindcă există o eroare pe câmp: ecranul nu arată NIMIC.
- Garda afișelor din acțiune rulează indiferent de variantă, deci o firmă cu `cod_qr`
  salvat și fără niciun punct activ cu cod e refuzată cu un mesaj despre afișe tocmai la
  salvarea în care codul QR nu mai pontează nimic.

Implicitul `zilnic` e scris în trei locuri care trebuie să rămână identice:
`IMPLICIT_PONTARE_RAPIDA.varianta`, `internal.pontaj_varianta` în SQL și `.default()`-ul
din schemă — ultimul e cel care ține un apelant vechi să nu mute firma pe săptămână din
greșeală. Întrebarea se pune o singură dată, cu `sePonteazaPeZi`.

## Cele două scrieri: 23505 nu e „o zi de pontaj"

`salveazaSetariPontaj` INSEREAZĂ întotdeauna, niciun UPDATE: o versiune nouă la fiecare
salvare. `attendance_settings_valabilitate_uq` (`0013_attendance.sql:54`) respinge a doua
versiune cu același `valabil_de_la`, iar `traduEroare` al pontajului traduce ORICE 23505 în
mesajul zilei de pontaj — omul de pe ecranul de setări citea despre „o zi de pontaj pentru
acest angajat". De aceea codul e prins ÎNAINTE de `traduEroare`, cu data cerută în mesaj.

`salveazaPontareaRapida` face invers: citire, apoi INSERT sau UPDATE. `.upsert()` nu e o
alternativă — indexul unic al tabelei e PARȚIAL (`where deleted_at is null`), iar PostgREST
nu emite predicatul în `ON CONFLICT`: Postgres refuză inferența la PLANIFICARE, deci apelul
ar cădea cu 42P10 la FIECARE salvare, nu doar la conflict (capcana #7). Refuzul politicii
se vede doar prin `.select()` după `.update()`, cu rezultatul gol tratat drept CONFLICT
(capcana #17). Amândouă au testele lor în `actions.test.ts`, pe clientul Supabase fals.

Revalidarea pontării rapide atinge și ecranele săptămânii, în aplicație și în portal —
`/pontaj/saptamana`, `/portal/pontajul-meu`, `/portal/pontajul-meu/saptamana` — nu doar
`/portal/ceas`: varianta schimbă exact ce desenează ele.

## Fila „Coduri QR": alt secret, altă poartă

`/pontaj/setari/coduri-qr` e a treia filă a setărilor și singura care nu salvează nicio
setare — arată codul însuși, din `puncte_lucru`, fără să dubleze nimic în bază. Lista
„Afișele de pontare" din fila „Pontarea" a plecat aici; acolo a rămas doar trimiterea,
fiindcă acolo se ia decizia care o face necesară.

**Poarta e `departments:update` la `all`, nu `attendance:update`** — aceeași ca afișul din
`puncte-lucru/[id]/afis`: păzește SECRETUL, iar cine vede codul poate ponta de oriunde.

- Fila vecină cere `attendance:update = all`. Pe matricea de ROLURI cele două nu se despart;
  un refuz PER MEMBRU da — `role_permissions.member_id` bate rândul de rol, inclusiv pe
  valoarea `none` (`0143_seful_iese_din_departament.sql:80`).
- Banda nu se mai scrie de mână: `FileModul` filtrează `FILE_SETARI_PONTAJ`
  (`src/config/file-module.ts`) prin poarta FIECĂREI file, din registrul porților de rută.
  Fila se stinge singură pentru cine n-o poate deschide, iar o bandă rămasă cu o singură
  filă nu se randează deloc — deci membrul refuzat per membru pe `attendance:update` vede
  pagina asta fără nicio navigare, nu o filă care cade pe `AccesRestrictionat`.
  `NavSetariPontaj` nu mai există. Restul linkurilor: [[modul/pontaj/navigare]].
- Linkurile care ies din ecran se sting în TEXT, nu dispar: „Coduri QR" din fila „Pontarea"
  (`poateVedeaCoduriQr`, pasat de pagină), „Salarizare → Setări" din fila juridică
  (`poateVedeaSalarizare` = modulul `payroll` activ ȘI `payroll:update` la `all`), iar în
  fila „Coduri QR" numele punctului de lucru și acțiunea stării goale cer `departments:read`
  — pe care `departments:update` n-o implică la un refuz per membru. Propoziția care explică
  de ce sporurile se setează în altă parte trebuie să rămână citibilă și fără link.
- **Baza nu e a doua barieră**: `puncte_lucru_select` cere doar `departments:read`. De asta
  verificarea stă înaintea citirii, nu după.

`afiseDePontare` NU selectează `cod_pontaj`; sora ei `coduriQrDePontare` îl selectează.
Șirul tot nu trece granița: din el iese un SVG pe server, iar spre client pleacă poza — și
adresa de sub cod, scrisă acolo intenționat, ca cineva s-o verifice înainte de a tipări.

`ButonCodQr` importă `rotesteCodPontaj` din `puncte-lucru/actions` în loc s-o rescrie: a
doua copie ar fi însemnat a doua allow-list de audit goală și al doilea `.select()` după
`.update()` (capcana #17). Acțiunea revalidează `/puncte-lucru`, **nu ruta asta** — poza nouă
vine din `router.refresh()`, nu din răspuns, deși răspunsul chiar conține codul; la refuz nu
se reîmprospătează nimic, ca mesajul să rămână pe ecran.

`afise` rămâne prop al lui `FormularPontareRapida` deși lista a plecat: „Numai prin cod QR"
se stinge când niciun punct ACTIV n-are cod, altfel alegerea ar fi oprit pontarea pentru
toată firma, tăcut.
