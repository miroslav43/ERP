---
tip: modul
titlu: REGES — Server Actions
cai:
  - "src/app/(app)/reges/actions.ts"
  - "src/app/(app)/reges/actiuni-api.ts"
  - "src/app/(app)/reges/constante.ts"
  - "src/lib/reges/coada.ts"
  - "src/app/api/reges/reconciliere/route.ts"
tabele:
  [
    reges_evenimente,
    reges_mesaje,
    reges_apeluri,
    reges_credentiale,
    reges_propuneri,
    reges_nomenclatoare,
    salary_component_types,
  ]
permisiuni: [reges:create, reges:update, reges:transmit, reges:configure, reges:export]
feature: reges
capcane: [17]
scris_pe: a67bb3cc1be0a37072b4d1bb96fb262cf8338586
scris_la: 2026-10-31
tags: [modul, hr]
---

# REGES — Server Actions

Secțiune extrasă din [[modul/reges]]: cele două fișiere de acțiuni, poarta fiecăreia și
ciclul prin care un mesaj pleacă la Inspecția Muncii.

## Server Actions

Sunt în **două** fișiere, toate la scope `all`:

- `src/app/(app)/reges/actions.ts` — ce nu atinge rețeaua: `marcheazaTransmis`
  (`reges:update`) și `exportaEvenimente` (`reges:export`).
- `src/app/(app)/reges/actiuni-api.ts` — ce vorbește cu Inspecția Muncii; antetul lui spune
  de ce ocolește RLS. `pregatesteTransmiterea`, `propunePlecarea` → `reges:create`;
  `transmiteMesajul`, `raspundePropunerii` → `reges:transmit`; `anuleazaMesajul`,
  `salveazaClasificarea` → `reges:update`; `salveazaCredentialele`, `testeazaConexiunea`,
  `comutaActivarea`, `sincronizeazaNomenclatoarele`, `creeazaSporAngajator` →
  `reges:configure`. `creeazaSporAngajator` înregistrează un spor **propriu firmei** în
  registrul angajatorului și scrie UUID-ul întors în
  `salary_component_types.reges_tip_spor_id` — act de configurare, nu transmitere de
  contract; n-are încă ecran.

**Poarta acțiunii trebuie să fie identică cu poarta paginii.** `marcheazaTransmis` a
declarat până la `0087` o cheie de citire, în timp ce pagina ținea butonul în spatele unei
chei de scriere — iar o Server Action se poate chema direct, fără ecran. Marcarea unui
eveniment drept transmis e o afirmație despre registrul oficial, deci acțiunea cere azi
exact ce gatează pagina. Regula se aplică peste tot, nu doar aici.

Revalidarea se **declară** pe fiecare acțiune; nu mai există nicio funcție exportată care
să cheme `revalidatePath` pentru alt apelant.

Reconcilierea cozii nu e o acțiune, ci ruta `src/app/api/reges/reconciliere/route.ts`.
Comanda care o cheamă nu se reproduce din memorie — sursa de adevăr e
`deploy/reges-reconciliere.service`, care trece secretul prin `-K -`, nu prin argv.

## Transmiterea își revendică mesajul înainte de a vorbi cu ITM

`transmiteMesajul` nu se mulțumește cu verificarea stării de la început: înainte de apelul
HTTP mută rândul `de_transmis` → `in_curs` cu un UPDATE **condiționat pe starea veche** și
cu `.select()` după el (capcana #17). Zero rânduri = altcineva a luat mesajul, iar acțiunea
se oprește cu „a plecat deja sau a fost anulat". Două apăsări simultane trec amândouă de
prima verificare; fără revendicare, fișa cu CNP pleca de două ori la Inspecția Muncii, iar
al doilea răspuns suprascria `response_id`-ul primului.

Din `in_curs` se iese pe toate drumurile, nu doar pe cel fericit:

- excepție neprevăzută din client → rândul se întoarce în `de_transmis`, ca să nu rămână
  blocat într-o stare pe care nimic nu o mai mișcă;
- refuz de validare (un 400 primește mereu același refuz) → `esuat`, fără reîncercare;
- orice alt refuz → înapoi în `de_transmis`, cu `incercari` mărit.

Marcarea finală (`asteapta_raspuns` + `response_id`) face și ea `.select()`, și tratarea
rezultatului gol e **inversul** celei obișnuite: mesajul A PLECAT. Raportat ca succes,
rândul rămânea fără `response_id`, reconcilierea nu-l mai putea lega, iar o a doua apăsare
retrimitea fișa — de aceea eroarea îi spune explicit operatorului să nu retrimită, ci să
reîncarce și să ceară verificarea răspunsurilor.
