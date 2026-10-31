---
tip: modul
titlu: Pontaj — setările firmei — aprobarea ca alegere a firmei
aliases: [pontaj-setari-aprobare, necesita-aprobare]
cai:
  - "src/app/(app)/pontaj/setari/**"
  - "src/domain/attendance/pontare-rapida.ts"
tabele: [setari_pontare_rapida, attendance_entries, attendance_week_submissions]
permisiuni: [attendance:update, attendance:approve]
feature: attendance
capcane: []
scris_pe: a67bb3cc1be0a37072b4d1bb96fb262cf8338586
scris_la: 2026-10-31
tags: [modul, hr]
---

# Pontaj — setările firmei — aprobarea ca alegere a firmei

Secțiune extrasă din [[modul/pontaj/setari]]: corpul paginii-mamă se apropia de plafonul
dur, iar pasul de aprobare e o alegere care se citește singură, fără restul setărilor.

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
