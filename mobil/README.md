# Administrativo — aplicația mobilă

Înveliș Expo peste portalul de angajat (`administrativo.ro/portal`), afișat
într-un `WebView`. Ecranele portalului NU sunt rescrise aici — o livrare pe web
apare instantaneu și în aplicație, fără trecere prin review-ul magazinului.

## Ce e nativ aici

Doar ce browserul de pe telefon nu poate da: notificări push, descărcare de
fișiere, lacăt biometric la deschiderea aplicației, scanare de cod QR pentru
pontaj. (Task-urile 8–10 din planul portalului mobil.) Scheletul de față
(Task 7) nu implementează niciuna dintre ele — doar proiectul Expo și
`WebView`-ul care afișează portalul.

## Rulare locală

```bash
cd mobil
pnpm install
pnpm start
```

## Izolare de restul monorepo-ului

`mobil/` are propriul `mobil/pnpm-workspace.yaml` (`packages: ["."]`), separat
de cel de la rădăcina depozitului (care conține doar `ignoredBuiltDependencies`,
fără câmp `packages:`). Fără granița proprie, `pnpm install` rulat aici
raportează „Done" cu cod de ieșire 0 și **nu instalează nimic** — nici
`node_modules/`, nici lockfile — pentru că rădăcina fără `packages:` nu tratează
`mobil/` ca pachet de instalat.

`mobil/pnpm-lock.yaml` **se comite** — e lockfile-ul aplicației. `node_modules/`
și artefactele Expo (`.expo/`, `dist/`) nu.

Lanțul de verificare de la rădăcină (`pnpm typecheck && pnpm lint && pnpm
test`) nu atinge `mobil/`: are propriul `tsconfig.json`, e exclus explicit din
ESLint-ul de la rădăcină și are propriul lockfile. Regulile de acolo — granița
server/client din Next.js, restricția pe clientul admin — n-au niciun înțeles
în React Native.

## Configurare

`app.config.ts` citește `URL_PORTAL` din mediu (implicit
`https://administrativo.ro/portal`). Nu se scrie literal în `App.tsx`: la
trecerea pe subdomenii per firmă, aici e singurul loc care se schimbă.

`extra.eas.projectId` rămâne gol până la `eas init` — nu se inventează o
valoare. Task 11 a scris `eas.json` și a verificat pluginurile (secțiunea
„Build EAS și publicare în magazine" de mai jos), dar n-a putut rula `eas
init` — cere contul EAS al proprietarului. Rămâne gol până atunci, nu e o
sarcină neterminată.

Culorile din `App.tsx` (`#0f1e3d`) și `app.config.ts` (`#0f1e3d`,
`#faf7f0`) sunt `theme_color` și `background_color` din
`src/app/manifest.ts`, ca bara de stare a aplicației să nu bată cu antetul
portalului web.

## Build EAS și publicare în magazine

Config-ul de build (`eas.json`, profilurile `intern`/`productie`) e scris și
verificat față de pachetele instalate azi. **Ce urmează mai jos NU s-a putut
executa**: cere `eas login`, `eas init` și conturile de magazin, care aparțin
proprietarului, nu acestei sesiuni. Secțiunea e drumul complet, pas cu pas, ca
cineva care are conturile să nu trebuiască să ghicească nimic.

### 0. Ce e deja pregătit, fără niciun cont

`plugins` din `app.config.ts` conține azi `expo-camera` (cu
`recordAudioAndroid: false` și `microphonePermission: false` — vezi
comentariul de acolo), `expo-notifications`, `expo-local-authentication`.
Restul pachetelor instalate care ar putea avea un config plugin
(`expo-file-system`, `expo-print`, `expo-sharing`, `expo-device`,
`expo-constants`, `expo-linking`, `expo-status-bar`) **nu trebuie** adăugate:
fiecare își aduce singur, prin `AndroidManifest.xml` propriu (mers verificat
direct în `node_modules/<pachet>/android/src/main/AndroidManifest.xml`, care
se combină automat la `prebuild`), tot ce-i trebuie pe Android — inclusiv
`INTERNET` — și niciunul nu are text de permisiune de scris pe iOS.
`expo-status-bar` are propriul `app.plugin.js`, dar fără opțiuni explicite
rulează ca no-op (verificat în sursă: fără `style`/`hidden` primite, întoarce
config-ul neatins) — stilul barei se dă la runtime, din `App.tsx`, nu la
build. Verificarea s-a făcut citind sursa fiecărui pachet instalat, nu
brief-ul inițial al sarcinii (scris înainte ca push-ul, descărcările și
scanner-ul să existe).

### 1. Cont EAS + `eas init` — leagă proiectul

```bash
cd mobil
pnpm dlx eas-cli@latest login     # cere un cont expo.dev, gratuit
pnpm dlx eas-cli@latest init
```

**Cere:** un cont expo.dev (gratuit, fără DUNS, fără card). **Produce:** un
`projectId` nou — pe care **trebuie să-l scrii de mână** în `app.config.ts`, la
`extra.eas.projectId` (azi `""`):

```ts
extra: { urlPortal: URL_PORTAL, eas: { projectId: "<id-ul-tipărit-de-eas-init>" } },
```

**`eas init` NU îl scrie singur aici, deși pentru majoritatea proiectelor o
face.** Verificat în sursa instalată, `@expo/config@57.0.9`,
`build/Config.js:347-405` — `modifyConfigAsync` scrie automat în exact două
situații: (1) proiectul **nu** are config dinamic (`:351`), sau (2) are ȘI un
`app.json` static, ȘI configul dinamic exportă o **funcție** (`:367`). `mobil/`
n-are `app.json`, iar `app.config.ts:67` exportă un **obiect**. Amândouă cad,
deci funcția ajunge la ramura finală și întoarce
`{ type: 'warn', message: 'Cannot automatically write to dynamic config at: app.config.ts' }`.

**Cum arată eșecul, exact:** `eas init` **reușește** — proiectul chiar se
creează pe expo.dev — dar în locul confirmării vezi avertismentul de mai sus, iar
`extra.eas.projectId` rămâne `""`. Nimic nu se rupe pe loc; se rupe abia pe
telefon, unde `getExpoPushTokenAsync()` aruncă (vezi comentariul de la `cereJeton`,
`push.ts:51`), `cereJeton()` întoarce `null` și push-ul pur și simplu nu se
înregistrează niciodată, tăcut.

**De unde iei identificatorul**, dacă ai închis terminalul: `pnpm dlx
eas-cli@latest project:info`, sau de pe expo.dev → proiectul → *Project settings*
→ *Project ID* (un UUID).

**Celălalt eșec posibil:** `eas init` refuză dacă `slug`/`owner` din config nu se
potrivesc cu ce alegi la crearea proiectului — acolo răspunsul e să accepți ce
propune CLI-ul, nu să editezi manual.

**Până la acest pas, `push.ts` → `cereJeton()` → `getExpoPushTokenAsync()`
ARUNCĂ** (verificat în cod, comentariul de la `cereJeton`): funcția prinde
excepția și întoarce `null`, deci aplicația nu cade, dar push-ul nu poate fi
probat pe niciun telefon — nici pe Expo Go, nici pe un build standalone —
înainte de acest pas.

### 2. Firebase — obligatoriu chiar pentru primul test de push pe Android

Push-ul pe Android trece prin Firebase Cloud Messaging, în doi pași separați,
cu **două fișiere diferite**:

1. **`google-services.json`** — înregistrează aplicația (`ro.administrativo.portal`)
   la Firebase, ca `getExpoPushTokenAsync()` să primească vreun jeton. Se
   descarcă din Firebase Console → Project settings → aplicația Android
   adăugată acolo. Se pune în `mobil/google-services.json` (fișier local, NU
   se comite — conține un ID de proiect Firebase; se adaugă la `.gitignore`)
   și se referă din `app.config.ts`:
   ```ts
   android: { googleServicesFile: "./google-services.json", ... }
   ```
   Fără el, jetonul de push pur și simplu nu se primește — nicio eroare
   explicită, doar un `getExpoPushTokenAsync()` care nu ajunge niciodată la
   „ok" (documentat oficial: „your app never receives a push token" dacă
   API-ul Firebase e restricționat greșit).
2. **Contul de serviciu FCM V1** (JSON separat, din Firebase Console →
   Project settings → Service accounts → „Generate new private key") — ăsta
   NU se pune în cod: se încarcă direct în EAS, la pasul 5.

**Nu există cale de a proba push-ul pe Android fără Firebase** — nici măcar
pe build-ul `intern`.

### 3. Primul build — profilul `intern`, doar Android, fără cont de magazin

```bash
pnpm dlx eas-cli@latest build --profile intern --platform android
```

**Cere:** contul EAS de la pasul 1 și `google-services.json` de la pasul 2.
**Nu cere** niciun cont Apple/Google — `distribution: "internal"` din
`eas.json` produce un `.apk` instalabil prin link direct, fără magazin.
**Produce:** un link de descărcare (afișat în terminal și pe
expo.dev/accounts/.../builds) — se deschide pe telefon și se instalează ca
orice APK din afara Play Store (cere „instalare din surse necunoscute" o
singură dată). **Eșecul arată ca:** build roșu în consola EAS, cu jurnalul
Gradle vizibil online — de obicei o problemă de config plugin, nu de cod
JS/TS (acelea le prinde deja `tsc`, rulat local).

**Important, și diferit de restul planului mobil:** probele din Task 8
(descărcare/tipărire), Task 9 (push) și Task 10 (lacăt, scanner) **nu se pot
relua în Expo Go** de-acum înainte:

- Expo Go pe **Android nu mai livrează push remote de la SDK 53** (verificat
  în documentația oficială Expo, versionată v57: „Push notifications... is
  unavailable in Expo Go on Android from SDK 53. A development build is
  required"). Local notifications tot merg în Expo Go — doar remote-ul, adică
  exact ce trimite `POST /api/push/livreaza`, nu.
- Chiar dacă push-ul ar merge, Expo Go **partajează credențiale** cu toate
  aplicațiile din Expo Go — jetonul obținut acolo nu e cel pe care îl vor
  vedea credențialele proprii, încărcate la pasul 5.

Build-ul `intern` de mai sus (nu Expo Go, nu `expo start` + scanare de QR)
e singurul loc unde probele astea trei au sens de-acum înainte.

### 4. Credențiale de platformă

```bash
pnpm dlx eas-cli@latest credentials
```

- **Android:** contul de serviciu FCM V1 de la pasul 2 (fișierul JSON —
  CLI-ul întreabă calea locală sau îl încarci direct din meniu).
- **iOS:** EAS generează singură cheia APNs (`.p8`) și certificatul de
  semnare, **dacă are contul Apple Developer** (membership activ, 99 USD/an) —
  nu trebuie generată manual în niciun caz.

Fără cont Apple, tot ce ține de iOS din secțiunile de mai jos rămâne blocat —
nu doar submit-ul, ci și un build `--platform ios`.

**Nu trebuie setat manual `aps-environment`.** `expo-notifications` scrie
implicit entitlementul `development` — dar documentația oficială confirmă că
Xcode îl schimbă singur în `production` la arhivarea unui build de
distribuție (`archive`), pas pe care EAS Build îl rulează intern la orice
profil care nu e development-client. Nu era nevoie de nicio opțiune `mode` în
`plugins` (verificat direct în sursă înainte de a lua decizia asta — pachetul
are un `mode` intern, dar nedocumentat, iar comportamentul documentat oficial
e cel descris aici).

### 5. Build de producție și trimitere

```bash
pnpm dlx eas-cli@latest build --profile productie --platform all
pnpm dlx eas-cli@latest submit --profile productie --platform all
```

Profilul `productie` din `eas.json` are `distribution: "store"` (implicit
`app-bundle`/`.aab` pe Android — ce cere Play Store azi, nu `.apk`) și
`autoIncrement: true`, care cere `cli.appVersionSource: "remote"` — deja setat
în `eas.json`, ca numărul de build/versiune să fie ținut pe serverele EAS, nu
local.

`submit` cere, la prima rulare interactivă, datele de cont pe care CLI-ul le
întreabă direct (`appleId`/`ascAppId`/`appleTeamId` pentru iOS,
`serviceAccountKeyPath` pentru Android) — de-asta `submit.productie` din
`eas.json` a rămas gol: nu există încă ce completa acolo fără conturile
proprietarului.

### 6. `URL_PORTAL` — unde nu poate ieși greșit

`app.config.ts` citește `process.env.URL_PORTAL`, cu implicit
`https://administrativo.ro/portal` — NICIODATĂ `localhost`. Ambele profiluri
din `eas.json` (`intern` și `productie`) setează explicit
`URL_PORTAL: "https://administrativo.ro/portal"` în `env`. Dacă cineva ar
adăuga un profil nou și ar uita `env`, tot n-ar ieși `localhost`: implicitul
din cod e deja domeniul de producție.

**Singura cale rămasă spre o valoare greșită:** `eas build --local` (nu
`eas build` obișnuit, care rulează izolat pe serverele EAS) moștenește mediul
shell-ului care îl invocă. Cineva care a exportat
`URL_PORTAL=http://localhost:3000` în sesiunea lui de terminal, ca să
testeze `expo start` contra unui Next local, și apoi rulează
`eas build --local --profile productie` din același terminal, ar putea
produce un build de producție cu portalul local înăuntru, fără ca `eas.json`
să fi greșit cu ceva. Recomandarea: `URL_PORTAL` nu se exportă permanent în
profilul de shell — se dă inline, o singură comandă (`URL_PORTAL=... pnpm start`)
— și build-urile de producție se fac cu `eas build` (cloud), nu `--local`.

### 7. Dosarul de magazin — ce se declară onest

**App Privacy (Apple) / Data Safety (Google)** se completează pe baza a ce
face aplicația NATIVĂ, nu pe presupuneri. Verificat în cod, nu ghicit:

- **Jeton de push + identificator de utilizator** — `POST /api/dispozitive`
  (`src/app/api/dispozitive/route.ts`) leagă `jeton` (jetonul Expo) de
  `user_id`/`organization_id`. Se declară: identificator de utilizator +
  identificator de dispozitiv, folosite pentru funcționalitatea aplicației
  (livrarea notificărilor), NU pentru publicitate.
- **Conținutul notificărilor trece printr-un terț: Expo.** Serverul nostru
  (`src/lib/push/expo.ts`) trimite `title`/`body`/`data.cale` direct la
  `https://exp.host/--/api/v2/push/send` — Expo Inc. vede textul fiecărei
  notificări înainte s-o predea la APNs/FCM. Se declară ca „shared with a
  third party" (Apple) / furnizor de servicii (Google), nu ca „sold" — Expo e
  doar releul tehnic, nu un partener de publicitate.
- **Date financiare, local pe dispozitiv** — `salveazaPdf` (`fisiere.ts`)
  scrie fluturașul de salariu (PDF, date financiare) în directorul de cache al
  aplicației și îl oferă prin foaia de partajare a sistemului. Se declară:
  date financiare, procesate pe dispozitiv, fără să fie trimise de aplicația
  NATIVĂ mai departe (partajarea e o acțiune explicită a omului, către
  aplicația pe care o alege el din foaie).
- **Biometria NU se declară drept „colectată".** `lacat.tsx` cheamă
  `LocalAuthentication.authenticateAsync()` — API-ul OS-ului întoarce doar
  adevărat/fals; nici Face ID, nici amprenta nu ajung vreodată la aplicație
  sau la vreun server. Un „da" la „colectați date biometrice" ar fi o
  declarație FALSĂ, nu una prudentă.
- **Camera** — doar pentru scanare QR (`scanner.tsx`, ML Kit local, pe
  dispozitiv); niciun cadru nu părăsește telefonul. Nu se cere microfon (vezi
  §0) — dacă formularul întreabă separat despre microfon, răspunsul e „nu".

### 8. Dacă Apple respinge pe ghidul 4.2 („Minimum Functionality")

Nu e o surpriză — riscul e numit explicit în specificația portalului mobil
(§11.1): o aplicație-înveliș peste un site poate fi respinsă dacă „nu aduce
nimic peste browser". Răspunsul din nota de review către Apple enumeră exact
ce NU poate face Safari/Chrome pe acest telefon, dar aplicația da:

- notificări push (Task 9) — Safari pe iOS nu livrează push de la un site
  fără PWA instalată separat, iar Chrome pe Android nu livrează push când
  aplicația/tab-ul e complet închis, în afara unui service worker înregistrat;
- deblocare biometrică proprie a aplicației (Task 10, `lacat.tsx`) — un tab de
  browser nu poate cere Face ID înainte de a-și arăta conținutul;
- scanner QR nativ (Task 10, `scanner.tsx`, cameră + ML Kit direct, fără
  pagină intermediară de permisiune HTML);
- tipărire nativă (Task 8, `Print.printAsync`, dialogul de sistem
  `UIPrintInteractionController`/echivalentul Android), nu „printează din
  meniul browserului".

Dacă tot nu trece, pasul următor e ecranul nativ de pontare din varianta C a
discuției de design — nu o rescriere a aplicației.
