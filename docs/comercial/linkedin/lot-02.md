# Lotul 2 — postările #5–#8 (13 – 22 oct 2026)

**Stare: ciornă.** #5 și #6 vin din prima ciornă (23 sept), trecute pe vocea
paginii; se finalizează — slide-uri, text alternativ, verificarea cifrelor — la
producția lotului, până pe **vineri 9 oct**, după cifrele primelor postări.
#7 are o ciornă verificată (23 sept, scrisă după skill-ul
`administrativo-postari`); #8 se scrie atunci.

- **#8 · J 22 oct · I** — Primirea la muncă fără contract: **40.000 lei**
  (`control-itm.ts`, `amenzi`).

---

## #5 · marți 13 oct · carusel — REGES prin API: ce e incomplet în documentație

**Pilon:** Culise (pătrat ocru). **Sursa:** faptele verificate direct pe API la implementare (memoria
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

**Pilon:** Unelte (pătrat verde). **Sursa:** `/unelte/foaie-de-pontaj`.
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

---

## #7 · marți 20 oct · carusel (8 slide-uri)

**Pilon:** Legislație (pătrat cerneală). **Sursă:** `src/content/legal/control-itm.ts`
(`reguli` — 8 intrări, `raspunsScurt`, secțiunile).

Calendarul spunea „7 documente”; `reguli` are 8 (plus extrasul REGES-Online și
documentele SSM). Sursa câștigă — spec-ul a fost corectat în același commit.

### Textul postării

> Un inspector ITM nu citește documentele unul câte unul. Le compară între ele — și
> de acolo apar majoritatea problemelor.
>
> La un control de fond, pe masă intră 8 documente: registrul unic de control,
> dosarele de personal, contractele cu actele adiționale, evidența orelor prestate
> zilnic, foile colective de prezență cu statele de plată, extrasul din
> REGES-Online, regulamentul intern cu contractul colectiv și documentele de SSM.
>
> Separat, fiecare pare în regulă. Comparate, nu: ore care nu se regăsesc în state,
> salarii nete peste cele declarate, oameni la muncă în perioada în care contractul
> le e suspendat.
>
> Cea mai frecventă neconformitate nu ține de disciplină, ci de forma foii:
> pontajul trece câte ore a lucrat fiecare, nu și la ce oră a început și la ce oră
> a terminat — deși art. 119 alin. (1) din Codul muncii cere exact asta.
>
> Iar refuzul nejustificat de a prezenta documentele, în cel mult 15 zile de la a
> doua solicitare, nu e contravenție. E infracțiune — art. 264 alin. (2) și (3) din
> Codul muncii.
>
> Voi știți exact unde stă fiecare dintre cele 8, în seara dinainte de un control?

**Primul comentariu:**
`Lista completă, cu fiecare temei de lege: https://administrativo.ro/ghid/control-itm?utm_source=linkedin&utm_medium=social&utm_campaign=t4-07-control-itm`

**Hashtag-uri:** #ITM #resurseumane #contabilitate

### Slide-urile

| #   | Șablon  | Conținut                                                                                                                                          | Text alternativ                                                                                       |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Copertă | **8** · „documente cerute la un control de fond” · „Nu se citesc separat. Se compară.” · eticheta „ghid · control ITM”                            | Cifra 8 mare, cu textul „documente cerute la un control de fond. Nu se citesc separat, se compară.”   |
| 2   | Regulă  | Registrele · **Registrul unic de control și extrasul din REGES-Online.** · temei: Legea 252/2003 · HG 295/2025                                    | Registrele: registrul unic de control și extrasul din REGES-Online.                                   |
| 3   | Regulă  | 02 · **Dosarele de personal**, câte unul pentru fiecare salariat. · temei: art. 8 HG 295/2025                                                     | Dosarele de personal, câte unul pentru fiecare salariat. Art. 8 din HG 295/2025.                      |
| 4   | Regulă  | 03 · **Contractele și actele adiționale**, cu o copie la locul de muncă. · temei: art. 16–17 Codul muncii                                         | Contractele și actele adiționale, cu o copie la locul de muncă. Articolele 16 și 17 din Codul muncii. |
| 5   | Regulă  | 04 · **Evidența orelor, zilnic, cu ora de început și de sfârșit.** De aici pornesc cele mai multe constatări. · temei: art. 119 alin. (1) C.m.    | Evidența zilnică a orelor, cu ora de început și de sfârșit. Articolul 119 din Codul muncii.           |
| 6   | Regulă  | 05 · **Foile de prezență și statele de plată**, cerute împreună cu evidența orelor, ca să fie comparate. · temei: art. 25 Legea 82/1991           | Foile de prezență și statele de plată, comparate cu evidența orelor. Art. 25 din Legea 82/1991.       |
| 7   | Regulă  | Regulamentul și SSM · **Regulamentul intern, contractul colectiv, fișele de aptitudini și de instruire.** · temei: art. 243 C.m. · Legea 319/2006 | Regulamentul intern, contractul colectiv și documentele de sănătate și securitate.                    |
| 8   | Final   | „Nu se citesc separat. Se compară.” · administrativo.ro/ghid/control-itm · „Urmărește pagina”                                                     | Slide final: nu se citesc separat, se compară. Ghidul complet pe administrativo.ro.                   |
