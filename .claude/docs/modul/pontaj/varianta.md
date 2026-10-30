---
tip: modul
titlu: Pontaj — varianta pe zi sau pe săptămână
aliases: [pontaj-varianta, varianta-pontaj]
cai:
  - "src/domain/attendance/pontare-rapida.ts"
  - "src/app/(app)/pontaj/file-pontaj.ts"
  - "src/app/(app)/pontaj/actions.ts"
  - "src/app/(app)/pontaj/saptamana/scrie-pontajul.ts"
  - "src/app/(app)/pontaj/sectiune-saptamana.tsx"
  - "src/domain/attendance/zi-de-pontat.ts"
tabele: [setari_pontare_rapida, attendance_entries, attendance_week_submissions]
permisiuni: [attendance:create, attendance:approve, attendance:update]
feature: attendance
capcane: []
scris_pe: 3760e43cc77bfb934a236ef82ab1475d647c0a11
scris_la: 2026-10-30
tags: [modul, hr]
---

# Pontaj — varianta pe zi sau pe săptămână

Alegerea firmei care decide pe ce cale se pontează omul. Se setează în
[[modul/pontaj/setari]]; fișa săptămânii, singura cale pe `saptamanal`, e în
[[modul/pontaj/saptamana]]. Trunchiul e [[modul/pontaj]].

## Ce se stinge pe `saptamanal`

`setari_pontare_rapida.varianta_pontaj` (`0165_pontaj_varianta_saptamanala.sql`), implicit
`zilnic`, citită în SQL de `internal.pontaj_varianta`. Pe `saptamanal`, fișa săptămânii e
SINGURA cale prin care omul se pontează: ceasul, confirmarea zilei, dialogul `CelulaZi` și
tragerea pe grilă nu mai scriu. Întrebarea se pune o singură dată, cu `sePonteazaPeZi`
(`pontare-rapida.ts`), ca niciun ecran să nu rămână cu un buton pe care serverul îl
refuză; filele o primesc prin `varianta` din `fileDePontaj`, iar „Planul săptămânii"
devine „Pontajul săptămânii".

## Refuzul, scris de două ori

Refuzul e scris de două ori, deliberat: `refuzaZiuaInVariantaSaptamanala` în
`salveazaZiPontaj`/`stergeZiPontaj` și în `pregatirePontareRapida`, plus triggerul BEFORE
`internal.pontaj_doar_pe_saptamana` ca plasă pentru orice cale care ocolește acțiunile —
politicile din `0013` lasă un `employee` să scrie direct prin PostgREST. Triggerul ridică
**P0001 cu ACELAȘI text**, nu 42501, fiindcă mesajul spune ce are de făcut omul. Scapă:
contextul de serviciu, `attendance:create = all` (responsabilul de pontaj corectează în
continuare foaia colectivă — varianta privește cum se pontează OMUL, nu corecturile),
rândurile de concediu și UPDATE-urile care ating doar decizia. Portița pe
`leave_request_id`, coloană scrisă de CLIENT, a fost strânsă de
`0166_pontaj_saptamanal_fara_portita_concediu.sql`.

Garda variantei merge PRIMA în `salveazaZiPontaj`, înaintea refuzului zilei din viitor sau
dinaintea angajării (`refuzulZilei`, `mesajRefuzZi`): pe `saptamanal` omul primește mesajul
variantei, nu pe celălalt. Al doilea refuz nu are scăparea pe `attendance:create = all` —
nici responsabilul de pontaj nu scrie o zi care n-a venit — iar textul lui trimite la fișa
săptămânii pe ORICE variantă, fiindcă acolo e planificarea și pe `zilnic`.

## Fișa devine pontaj

Fișa devine pontaj prin `scrieSaptamanaInPontaj` — la aprobare, sau pe loc la trimiterea
care se închide singură (0167). Scrierea e best-effort, fiindcă aprobarea e deja
înregistrată când se ajunge la ea, deci plasa zilnică
`internal.recupereaza_saptamani_fara_pontaj` (0169) reface ce a căzut și anunță ce nu se
poate deriva în SQL. Zilele unei luni `blocata` nu se scriu niciodată: clientul admin e
scutit de triggerul lunii, deci garda stă în cod.

`scrieSaptamanaInPontaj` scrie legitim zile VIITOARE — săptămâna aprobată înainte să fi
trecut — și de aceea refuzul zilei din viitor stă în `salveazaZiPontaj`, nu într-un CHECK pe
`attendance_entries`: o constrângere în bază ar fi omorât exact calea pe care varianta
`saptamanal` o face singura cale. Restul: [[modul/pontaj/saptamana]].
