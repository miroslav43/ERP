# REGES-Online (fost Revisal) — punere în funcțiune

De la 1 ianuarie 2026, REGES-Online a înlocuit definitiv Revisal. Modulul
transmite contractele și salariații direct prin API-ul Inspecției Muncii, fără
fișier de import purtat cu mâna.

Documentul ăsta e pentru cine PUNE ÎN FUNCȚIUNE modulul la o firmă-client.
Pentru la ce folosește și cum e construit, vezi
[`reges-online-arhitectura.md`](reges-online-arhitectura.md) — iar pentru
detaliul ultim, comentariile din `src/domain/reges/` și `src/lib/reges/`.

---

## 1. Ce trebuie știut înainte

**Fiecare firmă-client are propriile chei.** Nu există o cheie a aplicației.
Cheile se generează din contul de angajator al firmei, iar aplicația le
păstrează criptate, separat, per organizație.

**Sunt două medii.** Mesajele trimise în test NU au valoare legală. Trecerea pe
producție e o decizie explicită, luată după ce fluxul a fost probat cap-coadă.

|           | API                                   | Portal                                  | Autentificare                                    |
| --------- | ------------------------------------- | --------------------------------------- | ------------------------------------------------ |
| Test      | `https://api.dev.inspectiamuncii.org` | `https://reges.dev.inspectiamuncii.org` | `https://sso.dev.inspectiamuncii.org/realms/API` |
| Producție | `https://api.inspectiamuncii.ro` ⚠    | `https://reges.inspectiamuncii.ro`      | `https://sso.inspectiamuncii.ro/realms/API`      |

⚠ Baza API-ului de producție **nu a fost verificată de noi**; adresa de mai sus e
cea din documentația oficială. Serverul de autentificare de producție l-am
interogat direct și răspunde. Confirmați baza API din portalul de producție
înainte de go-live.

---

## 2. Obținerea unei chei de TEST — pas cu pas

1. **Înregistrare ca cetățean** în portalul de test,
   `https://reges.dev.inspectiamuncii.org`. Contul de persoană fizică e punctul
   de plecare: nu se cere acces la un registru fără el.
2. **Cerere de acces la registrul angajatorului.** Din contul de cetățean, se
   cere accesul la registrul firmei (CUI). În mediul de test cererea se aprobă
   singură sau prin panoul de administrare al mediului.
3. **Selectarea registrului.** După aprobare, se comută pe registrul firmei —
   altfel ecranele de mai jos arată contul personal, nu angajatorul.
4. **Generarea cheii API**: „Setări” → „Acces” → „Chei API”. Rezultă patru
   valori: `client_id` (de obicei `reges-api`), `client_secret`, `utilizator`,
   `parolă`.
5. **Introducerea lor în ERP**: „REGES-Online” → „Chei API”. Se cere permisiunea
   `reges:configure` (o au `org_admin` și `hr`).
6. **Testați conexiunea** din același ecran. Butonul cheamă `GET /api/Profile` —
   singurul apel din modul care nu schimbă nimic la Inspecția Muncii.
7. **Descărcați nomenclatoarele** (buton alăturat). Fără ele, listele de temeiuri
   legale rămân goale, iar câmpurile se completează liber.
8. **Porniți transmiterea.** Butonul refuză să pornească dacă testul de conexiune
   n-a reușit: o coadă care pleacă spre chei greșite se umple de erori.

> ⚠ `client_secret`-ul publicat în documentația oficială e **al mediului de
> test**. În producție e altul, generat de firmă. Confuzia asta e cauza cea mai
> probabilă a erorilor `invalid_client` raportate public.

---

## 3. Cum circulă un eveniment

```
  modificare în ERP          registrul de evenimente        coada de mesaje
  (angajare, încetare,  ──▶  reges_evenimente          ──▶  reges_mesaje
   suspendare, salariu)      + termenul legal calculat      (1..N, ordonate)
                                                                  │
                                       ┌──────────────────────────┘
                                       ▼
                    ┌─────────────────────────────────────┐
                    │ mesaj de SALARIAT → butonul „Transmite” │  (conține CNP)
                    │ orice altceva     → ciclul automat      │  (fără date personale)
                    └─────────────────────────────────────┘
                                       │
                                       ▼
                          recipisă (ResponseId), sincron
                                       │
                          rezultat (MessageResult), asincron
                                       │
                    identificatorul REGES ajunge pe angajat / contract
```

**De ce fișele de salariat pleacă manual.** Mesajul `Salariat` conține CNP-ul.
Apăsarea butonului rulează sub identitatea operatorului, deci decriptarea trece
prin funcția care o auditează, pe numele lui. Ciclul automat rulează fără
utilizator și ar ocoli exact acel audit — de aceea el duce doar contracte,
acțiuni și propuneri, care nu conțin date personale.

**O angajare nouă produce DOUĂ mesaje**, în ordine: întâi salariatul, apoi
contractul. Al doilea nu poate fi nici măcar construit până nu sosește
identificatorul din primul — coada îl ține până atunci și o spune în ecran.

---

## 4. Ciclul de reconciliere

Rulează pe VM, dintr-un timer systemd, la 10 minute:

```bash
sudo cp deploy/reges-reconciliere.{service,timer} /etc/systemd/system/
sudo install -d -m 700 /etc/administrativo
printf 'REGES_CRON_SECRET=%s\n' "$(openssl rand -base64 32)" \
  | sudo tee /etc/administrativo/reges.env >/dev/null
sudo chmod 600 /etc/administrativo/reges.env
# ACEEAȘI valoare trebuie pusă și în .env.production, apoi stack:deploy.
sudo systemctl daemon-reload
sudo systemctl enable --now reges-reconciliere.timer
systemctl list-timers reges-reconciliere
journalctl -u reges-reconciliere -n 50
```

Cât timp `REGES_CRON_SECRET` e gol, ruta refuză orice cerere: o instalare fără
secret are ciclul **oprit**, nu deschis.

Stack-ul rulează cu două replici, iar cozile REGES sunt consumatoare — fiecare
citire avansează cursorul angajatorului. Serializarea o dă o închiriere în bază
(`reges_inchiriere`), luată atomic, cu termen. Un al doilea ciclu primește 409 și
se retrage; timerul tratează 409 ca succes.

---

## 5. Detașări și mutări

Nu se transmite o detașare, ci o **propunere**, pe care angajatorul destinație o
acceptă sau o respinge separat.

- „REGES-Online” → „Propuneri detașare” arată ambele sensuri.
- O propunere PLECATĂ se creează din același ecran; cere CUI-ul destinației,
  perioada și temeiul legal — date pe care contractul nostru nu le are.
- O propunere PRIMITĂ apare acolo după ce ciclul o culege din coada Inspecției
  Muncii. Acceptarea și respingerea cer `reges:transmit`.
- Salariatul dintr-o propunere primită apare **doar cu ultimele patru cifre de
  CNP**: e un om care nu e (încă) angajatul nostru, iar datele lui n-au ce căuta
  întregi la noi.

---

## 6. Ce se vede când ceva nu merge

| Simptom                          | Unde se uită                       | Ce înseamnă                                           |
| -------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| „Cheile API nu sunt configurate” | REGES-Online → Chei API            | firma n-a completat încă nimic                        |
| Ultima verificare a eșuat        | același ecran, bandă roșie         | chei greșite, sau mediul greșit                       |
| Mesaj în „Respins”               | coada de pe ecranul principal      | Inspecția Muncii a refuzat; motivul e scris sub stare |
| „Așteaptă mesajul precedent”     | coloana de acțiuni                 | contractul așteaptă identificatorul salariatului      |
| Coada nu se mișcă                | `journalctl -u reges-reconciliere` | timerul nu rulează, sau transmiterea e oprită         |

Jurnalul apelurilor (`reges_apeluri`) păstrează metoda, calea, statusul și durata
— **niciodată corpurile**. O cerere `Salariat` e, în întregime, dată personală;
mascarea perfectă e să n-o stochezi. Mesajele de eroare venite de la ITM trec
printr-un curățător care ascunde CNP-urile și IBAN-urile înainte de scriere.

---

## 7. De confirmat separat

1. **Baza API a producției** — vezi §1.
2. **Termenele legale** din `reges_termene` vin din H.G. 905/2017. Dacă mai sunt
   cele în vigoare sub norma REGES 2025 **nu am verificat**. Sunt date, nu cod:
   se corectează fără deploy. `NOTES.md` le marchează deja ⚠.
3. **Plafonul lotului de citire** (`messages`) nu e documentat. Pornim de la 20.
4. **Limitele de rată** nu sunt documentate. Ne le impunem singuri.
5. **`hr` are `reges:configure`** — prompt-ul cerea „admin și hr_manager", iar
   rolul cel mai apropiat din proiect e `hr`. Strângerea la `org_admin` se face
   per firmă, din `role_permissions`, fără deploy.
