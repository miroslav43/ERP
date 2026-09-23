# Lotul 1 — săptămânile 1 și 2

Ciorne. Ce e între `[ ]` completează Miro. Ce e marcat ⚠ se verifică înainte de
publicare. Linkul din „Primul comentariu” se lipește ca prim comentariu, imediat
după publicare.

---

## S01 · marți — De ce construiesc Administrativo

**Scop:** prezentarea. Fără ea, restul postărilor vin de la un necunoscut.
**Imagine:** o captură reală din aplicație (calendarul de concedii sau pontajul),
nu o siglă.

> De [X luni] construiesc un program pentru ce se întâmplă în firmele mici după
> ce se face angajarea: pontaj, concedii, REGES, SSM.
>
> [Momentul tău, 2–3 propoziții, concret: ce ai văzut la o firmă anume. Un
> Excel de pontaj cu sărbătorile de anul trecut, o cerere de concediu pierdută,
> un contract transmis prea târziu. Cu cât e mai specific, cu atât merge mai
> bine.]
>
> Ce am învățat până acum:
>
> → Cea mai scumpă greșeală nu e în salariu, e în calendar. Un contract nou se
> transmite în REGES cel târziu în ziua DINAINTEA începerii activității. În ziua
> în care omul vine la lucru e deja prea târziu: 20.000 de lei pe persoană.
>
> → Legea e mai simplă decât folclorul ei. Pragul de 5 km la diurnă, de exemplu,
> nu se aplică firmelor private. Joi scriu de ce.
>
> → O firmă cu 10 oameni nu are nevoie de un ERP de corporație. Are nevoie să nu
> uite nimic.
>
> De acum scriu aici de două ori pe săptămână despre legislația muncii în
> practică: diurnă, concedii, REGES, controlul ITM. Cu articolul de lege lângă
> fiecare afirmație.
>
> Dacă ții evidența pentru o firmă — sau pentru 30, cum fac mulți contabili —
> spune-mi ce te doare cel mai tare. Citesc tot.

**Primul comentariu:** `https://administrativo.ro/?utm_source=linkedin&utm_medium=social&utm_campaign=s01-poveste`
**Hashtag-uri:** #resurseumane #contabilitate #antreprenoriat

---

## S01 · joi — Diurna: plafonul nu e scris în nicio lege

**Sursa:** `src/content/legal/diurna.ts` → `/ghid/diurna`.
**Imagine:** opțional, un calcul scris de mână sau un tabel simplu cu cele două
plafoane.
⚠ **Verifică înainte:** cei 23 de lei/zi (HG 714/2018, actualizat prin ordin de
ministru). Dacă s-au schimbat, se schimbă și 57,50 — și trebuie actualizată și
pagina.

> Diurna neimpozabilă de 57,50 lei pe zi nu e scrisă în nicio lege.
>
> E o înmulțire: 2,5 × 23 lei, nivelul stabilit pentru instituțiile publice prin
> HG 714/2018. Când se schimbă cei 23 de lei, plafonul se mută singur, fără să se
> atingă nimeni de Codul fiscal.
>
> Încă două lucruri pe care le văd greșite des:
>
> 1️⃣ Cei 5 km nu sunt o regulă pentru firmele private. Pragul vine din aceeași
> hotărâre, care se aplică sectorului public. Codul muncii (art. 43–44) nu pune
> nicio condiție de distanță pentru delegare.
>
> 2️⃣ Există un al doilea plafon: 3 salarii de bază, calculat SEPARAT pentru
> fiecare lună (art. 76 alin. 2 lit. k Cod fiscal).
> La 6.000 de lei salariu de bază și 21 de zile lucrătoare iese 857 de lei pe zi —
> de obicei nu contează. Contează în transport și construcții, unde diurna mare
> acoperă un salariu de bază mic.
> Iar o delegare de pe 28 martie până pe 4 aprilie are două plafoane, nu unul.
>
> Partea liniștitoare: diurna calculată greșit nu e contravenție în Codul muncii.
> E o reîncadrare fiscală — diferența devine venit din salarii, cu impozit și
> contribuții.
>
> Voi cum calculați plafonul când delegarea trece dintr-o lună în alta?

**Primul comentariu:** `Ghidul complet, cu articolul lângă fiecare regulă: https://administrativo.ro/ghid/diurna?utm_source=linkedin&utm_medium=social&utm_campaign=s01-diurna`
**Hashtag-uri:** #diurna #contabilitate #resurseumane

---

## S02 · marți — REGES prin API: ce greșește documentația

**Sursa:** faptele verificate direct pe API la implementare (memoria
`reges-api-fapte-verificate`) + `src/content/legal/reges.ts` → `/reges-online`.
**Cea mai valoroasă postare din lot:** materialul ăsta nu-l mai are aproape
nimeni. Scrisă pentru contabili și patroni, nu pentru programatori.
**Ton:** constatare, nu atac la adresa Inspecției Muncii.

> Am conectat un program la REGES-Online prin API. Documentația oficială e
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

**Primul comentariu:** `Termenele complete de transmitere, cu articolul din HG 295/2025: https://administrativo.ro/reges-online?utm_source=linkedin&utm_medium=social&utm_campaign=s02-reges`
**Hashtag-uri:** #REGES #resurseumane #contabilitate

---

## S02 · joi — Foaia de pontaj care își calculează sărbătorile

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

**Primul comentariu:** `https://administrativo.ro/unelte/foaie-de-pontaj?utm_source=linkedin&utm_medium=social&utm_campaign=s02-foaie`
**Hashtag-uri:** #pontaj #resurseumane #IMM
