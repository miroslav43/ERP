---
tip: modul
titlu: Pontaj — setările firmei — refuzul lângă caseta vinovată
aliases: [pontaj-setari-formulare]
cai:
  - "src/app/(app)/pontaj/setari/**"
tabele: [attendance_settings, setari_pontare_rapida]
permisiuni: [attendance:update]
feature: attendance
capcane: []
scris_pe: a67bb3cc1be0a37072b4d1bb96fb262cf8338586
scris_la: 2026-10-31
tags: [modul, hr]
---

# Pontaj — setările firmei — refuzul lângă caseta vinovată

Secțiune extrasă din [[modul/pontaj/setari]]: corpul paginii-mamă se apropia de plafonul
dur, iar felul în care cele două formulare arată un refuz nu depinde de ce setare se salvează.

## Refuzul se arată lângă caseta vinovată, nu sub buton

Ambele formulare ale ecranului trec prin `Camp` (`src/components/ui/camp.tsx`); cel
juridic trece și prin `Formular` (`src/components/ui/formular.tsx`). Trei consecințe care
nu se citesc din markup:

- **Caseta golită nu se mai salvează ca zero.** Cele trei câmpuri numerice CONTROLATE ale
  formularului juridic — `ore_pe_zi`, `pauza_masa_minute`, `pauza_obligatorie_peste_ore` —
  pleacă din stare, nu din `FormData`, și golite ajung `null` sau șir gol, niciodată `0`.
  Un `?? 0` pe drum ar fi ocolit chiar plasa din schemă: `numarObligatoriu`
  (`src/schemas/comun.ts:205`) scoate golul ÎNAINTE de coerciție, dar un zero explicit
  arată ca o cifră aleasă — iar șapte parametri ai ecranului au plafonul de jos chiar 0.
  „Repaus zilnic minim: 0 ore" e o afirmație juridică pe care n-a făcut-o nimeni, și pe
  care `app.verifica_pontaj` o folosește apoi ca să nu mai avertizeze niciodată.
- **Ce s-a tastat rămâne pe ecran după un refuz.** Cu `<form action={…}>` și câmpuri
  necontrolate, React 19 RESETEAZĂ formularul după acțiune; `Formular` ține valorile prin
  `useActionState` și le dă înapoi. Fără el, o cifră greșită într-o casetă golea celelalte
  paisprezece.
- **`required` nu oprește nimic în browser**: `Formular` pune `noValidate` pe `<form>`, ca
  bulele native în engleză să nu ia locul mesajelor românești ale schemei. Steluța și
  „(obligatoriu)" din `Camp` sunt semantică, nu barieră — refuzul rămâne al lui Zod și al
  `check`-urilor din bază.

Fila „Pontarea" NU poate folosi `Formular`: nu e un `<form>` — alegerile sunt carduri, iar
salvarea e un `onClick`. Își ține harta de erori de mână, din același
`ActionResult.fieldErrors`, și verifică pe client regula „modul care propune un interval
cere o oră" înainte de drumul la server, cu mesajul schemei cuvânt cu cuvânt
(`setariPontareRapidaSchema`, `src/schemas/attendance.ts:507`). Butonul „Salvează" nu se
mai stinge când lipsește ora: un buton stins nu spune ce lipsește.

Drumul de la `ActionResult` până la pixelul de lângă câmp e prins la nivelul ECRANULUI, nu
al schemei, în `formular-setari-pontaj.test.tsx` și `formular-pontare-rapida.test.tsx`.
