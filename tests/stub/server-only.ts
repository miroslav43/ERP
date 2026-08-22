// Stub pentru pachetul `server-only`, folosit DOAR de proiectul `unit` din
// `vitest.config.mts`.
//
// Pachetul real aruncă la import („This module cannot be imported from a Client
// Component module"), fiindcă exportul lui pentru condiția non-`react-server` e
// intenționat o eroare. În Next.js asta e util: marchează modulele care nu au
// voie în bundle-ul de client. Într-un test node, însă, blochează complet
// verificarea unor funcții PURE — `mapPostgrestError`, `redactPayload` — care
// n-au nici I/O, nici secrete, dar trăiesc în fișiere marcate `server-only`.
//
// Alternativa ar fi fost să scoatem marcajul din `src/lib/actions/errors.ts` și
// `audit.ts` ca să devină testabile (soluția aleasă de `src/config/routes.ts`,
// care spune asta explicit în comentariu). Am preferat stub-ul: marcajul are un
// rost real în producție, iar un fișier de test nu trebuie să slăbească granița
// server/client ca să se poată rula.
//
// Nu schimbă NIMIC din ce se livrează: `next build` rezolvă pachetul adevărat.
export {};
