---
tip: modul
titlu: Pontaj — setările firmei
aliases: [pontaj-setari, pontare-rapida]
cai:
  - "src/app/(app)/pontaj/setari/**"
  - "src/domain/attendance/pontare-rapida.ts"
  - "src/domain/attendance/limite-legale.ts"
tabele: [setari_pontare_rapida, attendance_settings, puncte_lucru]
permisiuni: [attendance:update, attendance:read]
feature: attendance
capcane: [17]
scris_pe: 00e37653eadf3e9d2827de0ebf88e9a043eec856
scris_la: 2026-09-04
tags: [modul, hr]
---

# Pontaj — setările firmei

Două ritmuri de scriere, deliberat despărțite. `attendance_settings` e VERSIONATĂ prin
`valabil_de_la` — o lună calculată trebuie să rămână explicabilă cu parametrii de atunci.
`setari_pontare_rapida` e un rând per firmă, rescris, fără istoric: acolo stau alegerile
OPERAȚIONALE, care n-au ce reconstitui pentru o lună trecută.

## Pontarea rapidă are tabela ei (0115)

`setari_pontare_rapida` — **un rând per firmă, fără `valabil_de_la`**. Numele vine de la
primele trei coloane; din 0118 poartă și `necesita_aprobare`, deci e tabela setărilor
OPERAȚIONALE de pontaj, nu doar a celor de pe telefon. Cele trei coloane
(`mod_pontare_rapida`, `verificare_pontare`, `program_start`) au plecat din
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

## Locul de muncă și aprobarea ca alegere a firmei (0118)

**`attendance_entries.tip_prezenta`** — același enum `attendance_presence_kind` ca planul
săptămânal (0041), ajuns pe pontajul REAL abia acum. **Nullable, fără `default`**: zilele
de dinainte de 0118 și tot ce scrie pontarea rapidă de pe telefon n-au declarat nimic, iar
un backfill s-ar citi mai târziu drept alegerea cuiva — lecția scrisă în 0115 despre
`mod_pontare_rapida = 'oprit'`. Implicitul pentru o zi NOUĂ e `birou` și stă în COD
(`celula-zi.tsx`); o zi EXISTENTĂ fără declarație se deschide pe „Nedeclarat", altfel
„Salvează" ar scrie o afirmație pe care n-a făcut-o nimeni.

**`setari_pontare_rapida.necesita_aprobare`** — `true` implicit, și pentru firma FĂRĂ rând.
Sursa unică a implicitului e perechea `internal.pontaj_necesita_aprobare` (SQL) ↔
`IMPLICIT_PONTARE_RAPIDA.necesitaAprobare` (TS): dacă una se schimbă, triggerul și ecranul
decid altfel pentru aceeași firmă.

Stinsă, setarea scoate PAȘI, nu adaugă privilegii — și asta e toată ideea:

- Politica INSERT (`0013:789`) cere `approved_at is null`; politica UPDATE (`0013:795`)
  lasă modificările **doar** cât timp e null. Împreună dau exact ce vrea o firmă fără
  aprobare: ziua se salvează, rămâne salvată și rămâne EDITABILĂ. Nimic nu se ștampilează,
  deci reaprinderea setării e simetrică.
- Planul săptămânal e singurul care are nevoie de o stare terminală: triggerul din §3 îl
  duce direct pe `aprobata`, fără `approval_tasks` și fără notificări (`notifica_decizie`
  e păzită de aceeași funcție — altfel angajatul primea „a fost aprobat" de la nimeni).
- **Capcana pe care o repară §5**: upsert-ul din `trimite_saptamana_pontaj` (`0084:103`)
  are `where … status in ('ciorna','trimisa','respinsa')`, deci auto-aprobarea ar fi
  ÎNGHEȚAT planul la prima trimitere, cu mesajul „Săptămâna a fost deja aprobată". Garda se
  ridică doar unde n-a decis nimeni. Ecranele au ramura pereche în `poateEdita`; despărțite,
  ar oferi un buton pe care baza îl refuză.
- Badge-ul trece prin `etichetaStareSaptamana(stare, necesitaAprobare)`: `aprobata` fără
  pas de aprobare se scrie **„Salvat"**, nu „Aprobată" — n-a decis nimeni nimic.

Ce se DESENEAZĂ se decide o singură dată, în `file-pontaj.ts`: `poateAproba` compune
permisiunea cu alegerea firmei, iar `necesitaAprobare` rămâne separat pentru textul de pe
butoane (un `employee` are `poateAproba = false` oricum, dar butonul lui trebuie să spună
„Trimite spre aprobare" într-o firmă care aprobă). Condiția stătea în CINCI locuri; a doua
condiție adăugată în fiecare garanta că unul rămâne în urmă.

**Ascunderea nu e barieră.** `refuzaCandAprobareaEStinsa` (`aprobarea-firmei.ts`) oprește
cele trei acțiuni de decizie, iar `/pontaj/aprobare` arată o stare goală care trimite în
Setări în loc de o listă goală care s-ar citi drept „nu mai are nimeni nimic de aprobat".

## Limitele legale: se AVERTIZEAZĂ, nu se refuză

`src/domain/attendance/limite-legale.ts` (pur, cu teste) + `pontaj/avertismente.ts`
(citirile) + `pontaj/lista-avertismente.tsx` (ecranul). Cele două acțiuni de scriere —
`salveazaZiPontaj` și `trimiteSaptamanaPontaj` — întorc `{ id, avertismente }`, calculate
DUPĂ scriere. Forma veche a rezultatului a rămas întreagă; `avertismente` s-a adăugat
lângă ea.

Codurile: `repaus_zilnic` · `repaus_saptamanal` · `saptamana_peste_maxim` ·
`saptamana_peste_norma` · `medie_perioada_referinta` · `suplimentare_nepermise` ·
`noapte_nepermisa` · `zi_de_repaus_lucrata` · `sarbatoare_lucrata` ·
`compensare_sarbatoare`. Severitatea `informativ` e pentru ce e legal și doar merită spus
(norma depășită = ore suplimentare); `avertisment` e pentru o limită a firmei depășită.

Trei reguli care nu se pot deduce din cod citindu-l pe sărite:

- **Firma fără rând în `attendance_settings` nu primește NICIUN avertisment.**
  `limiteleFirmei(null)` întoarce `null`, iar toate cele trei intrări publice ies cu
  listă goală. Un plafon implicit ar fi pus o cifră juridică neconfirmată pe ecran.
- **Aceleași coduri și aceeași aritmetică sunt deja în SQL**, în `app.verifica_pontaj`
  (`0013_attendance.sql:582`), care NU e apelabilă: trăiește în schema `app`, iar
  PostgREST expune doar `public`. Cine schimbă formula într-un loc o schimbă în amândouă.
- **`termen_compensare_suplimentare_zile` rămâne neacoperit**, deliberat:
  `overtime_compensation` n-are niciun scriitor în tot produsul — nici trigger, nici cod —
  deci n-ar avea ce număra. Perechea lui, `termen_compensare_sarbatoare_zile`, se
  verifică: triggerul `internal.pontaj_genereaza_compensare_sarbatoare` (`0013:387`) chiar
  scrie rândul în `holiday_compensation`, de unde salarizarea plătește.

Ce se vede unde: formularul zilei din portal RĂMÂNE pe ecran când există avertismente (o
navigare imediată le-ar fi făcut să clipească); formularul săptămânii le arată sub cifre;
foaia colectivă le calculează în CLIENT, din luna deja încărcată, fără nicio citire nouă —
de aceea acolo lipsesc media pe perioada de referință și repausul de la granița lunii, iar
panoul o spune.
