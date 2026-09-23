# Lotul 2 — postările #5–#8 (13 – 22 oct 2026)

**Stare: ciornă.** #5 și #6 vin din prima ciornă (23 sept), trecute pe vocea
paginii; se finalizează — slide-uri, text alternativ, verificarea cifrelor — la
producția lotului, până pe **vineri 9 oct**, după cifrele primelor postări.
#7 și #8 se scriu atunci.

- **#7 · Ma 20 oct · C** — Control ITM: cele 7 documente cerute la un control de
  fond și cum se compară între ele (`control-itm.ts`, `raspunsScurt`).
- **#8 · J 22 oct · I** — Primirea la muncă fără contract: **40.000 lei**
  (`control-itm.ts`, `amenzi`).

---

## #5 · marți 13 oct · carusel — REGES prin API: ce e incomplet în documentație

**Sursa:** faptele verificate direct pe API la implementare (memoria
`reges-api-fapte-verificate`) + `src/content/legal/reges.ts` → `/reges-online`.
**Cea mai valoroasă postare din T4:** materialul ăsta nu-l mai are aproape
nimeni. Scrisă pentru contabili și patroni, nu pentru programatori.
**Ton:** constatare, nu atac la adresa Inspecției Muncii.

> Am conectat Administrativo la REGES-Online prin API. Documentația oficială e
> incompletă în câteva locuri — și unele lipsuri se văd abia când se pierde ceva.
>
> Din 1 ianuarie 2026, REGES-Online e registrul unic (HG 295/2025). Tot mai multe
> programe promit „transmitere automată”. Ce am aflat implementând-o:
>
> 🔑 Nu există o cheie a furnizorului care deschide toate firmele. Fiecare
> angajator își generează accesul din propriul cont. E un lucru bun — și o
> întrebare utilă pentru orice furnizor: cum anume transmiteți în numele meu?
>
> 📬 Răspunsurile nu vin pe un singur canal, ci pe cinci: statusurile, plus
> propunerile de detașare și de mutare, trimise și primite. Documentația le
> amestecă. O integrare scrisă doar după ea poate pierde în tăcere răspunsurile
> pe detașări și mutări.
>
> 📄 Unele operații din exemplele oficiale nu există în forma descrisă. Schema
> tehnică reală spune altceva. Le-am verificat pe rând, direct pe API.
>
> Iar regula care contează indiferent de program: un contract nou se transmite
> cel târziu în ziua dinaintea începerii activității. Altfel, 20.000 de lei
> pentru fiecare persoană, cu plafon la 200.000.
>
> Voi transmiteți manual, din portal, sau printr-un program? Ce a mers prost la
> trecerea din ianuarie?

**Primul comentariu:** `Termenele complete de transmitere, cu articolul din HG 295/2025: https://administrativo.ro/reges-online?utm_source=linkedin&utm_medium=social&utm_campaign=t4-05-reges-api`
**Hashtag-uri:** #REGES #resurseumane #contabilitate

---

## #6 · joi 15 oct · imagine — Foaia de pontaj care își calculează sărbătorile

**Sursa:** `/unelte/foaie-de-pontaj`.
**Imagine:** captură a foii generate pentru o lună cu sărbători (de ex. aprilie
2027, cu Paștele), cu weekendurile și sărbătorile vizibil marcate.

> Un șablon de pontaj descărcat anul trecut arată perfect. Și e greșit.
>
> Paștele ortodox, Vinerea Mare și Rusaliile se mută în fiecare an. Șablonul
> static le ține unde erau când l-a făcut cineva.
>
> Am făcut o foaie de pontaj lunară care nu are problema asta:
>
> ✅ alegi luna, anul și numărul de oameni
> ✅ weekendurile și sărbătorile legale se marchează singure — calculate, nu
> scrise de mână
> ✅ o tipărești sau o descarci în Excel
> ✅ fără cont, fără e-mail
>
> Setările rămân în adresă, deci poți trimite colegului linkul cu foaia gata
> completată.
>
> E gratuită și rămâne gratuită. E același calendar pe care rulează aplicația,
> scos la vedere.
>
> Ce altă unealtă mică v-ar scuti de o oră pe lună?

**Primul comentariu:** `https://administrativo.ro/unelte/foaie-de-pontaj?utm_source=linkedin&utm_medium=social&utm_campaign=t4-06-foaie`
**Hashtag-uri:** #pontaj #resurseumane #IMM
