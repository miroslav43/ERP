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

`extra.eas.projectId` rămâne gol până la `eas init` (Task 11) — nu se
inventează o valoare.

Culorile din `App.tsx` (`#0f1e3d`) și `app.config.ts` (`#0f1e3d`,
`#faf7f0`) sunt `theme_color` și `background_color` din
`src/app/manifest.ts`, ca bara de stare a aplicației să nu bată cu antetul
portalului web.
