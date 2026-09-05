# Închiderea lanțului de push pe VM

Scris 2026-09-04, după verificarea stării reale a mașinii. Cinci minute, o
singură dată. Până sunt făcuți pașii ăștia, **nicio notificare nu pleacă** —
aplicația se instalează, portalul merge, jetonul se înregistrează, rândurile se
adună în `push_livrari`, și acolo rămân. Nu apare nicio eroare nicăieri.

## Ce lipsește acum, verificat pe mașină

| Verificare                               | Stare la 2026-09-04   |
| ---------------------------------------- | --------------------- |
| `PUSH_CRON_SECRET` în `.env.production`  | lipsește              |
| `/etc/administrativo/`                   | nu există             |
| `push-livrare.timer` instalat            | nu                    |
| `PUSH_CRON_SECRET` în `docker-stack.yml` | **există** (linia 82) |
| Migrarea `0122` pe cloud                 | **aplicată**          |

Deci lipsesc exact trei lucruri, iar al patrulea și al cincilea sunt gata.

## Scurt: un script

```bash
cd /srv/apps/ERP
./deploy/instaleaza-timer.sh push
```

Face toți pașii de mai jos, în ordine, și verifică la final. E **idempotent** —
se poate rula de câte ori vrei — și, dacă secretul există deja undeva, îl
REFOLOSEȘTE în loc să genereze altul, fiindcă exact asta ar rupe potrivirea pe
care o construiește. Întreabă înainte de `stack:deploy`. Nu se rulează cu
`sudo`: cere el, unde trebuie.

Pentru REGES, același script: `./deploy/instaleaza-timer.sh reges`.

## Pașii, dacă vrei să-i faci de mână

Se rulează de pe VM, din `/srv/apps/ERP`. Comentariile spun de ce, nu doar ce.

```bash
cd /srv/apps/ERP

# ── 1. Secretul, o singură dată ────────────────────────────────────────────
# `base64` e forma deja documentată în unitate și în `.env.production.example`,
# iar caracterele ei speciale (+ / =) au fost probate prin `curl -K -`.
SECRET="$(openssl rand -base64 32)"

# ── 2. .env.production — de-aici îl citește `stack:deploy` ─────────────────
# `\n` la ÎNCEPUT, obligatoriu: fișierul NU se termină cu linie nouă (verificat),
# iar un `>>` fără el ar lipi variabila de ultima linie și ar strica ambele.
printf '\nPUSH_CRON_SECRET="%s"\n' "$SECRET" >> .env.production
tail -3 .env.production          # uită-te că e pe linia ei

# ── 3. Mediul timerului — root, 0600 ──────────────────────────────────────
sudo install -d -m 700 /etc/administrativo
printf 'PUSH_CRON_SECRET=%s\n' "$SECRET" | sudo tee /etc/administrativo/push.env >/dev/null
sudo chmod 600 /etc/administrativo/push.env

unset SECRET                     # să nu rămână în mediul shell-ului

# ── 4. Îl duce în container ───────────────────────────────────────────────
# OBLIGATORIU. `docker-stack.yml` enumeră explicit fiecare variabilă, iar Swarm
# nu propagă ce nu e enumerat. Fără pasul ăsta, secretul stă în .env.production
# și `serverEnv.PUSH_CRON_SECRET` rămâne `""` în container — iar ruta răspunde
# 404 chiar și la un apel cu secretul CORECT, indistinct de „rută inexistentă".
# Rulare health-gated, cu două replici: site-ul nu cade.
./administrativo.sh stack:deploy

# ── 5. Unitatea și timerul ────────────────────────────────────────────────
sudo cp deploy/push-livrare.service deploy/push-livrare.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now push-livrare.timer
```

## Verificarea — în ordinea asta, fiecare spune altceva

```bash
# (a) Timerul e programat?
systemctl list-timers push-livrare --no-pager
#     Trebuie să apară, cu NEXT în viitorul apropiat. Dacă lista e goală,
#     `enable --now` n-a prins — vezi `systemctl status push-livrare.timer`.

# (b) Ruta există și răspunde? (fără secret pe linia de comandă)
curl -sS -o /dev/null -w '%{http_code}\n' --resolve administrativo.ro:443:127.0.0.1 \
     -X POST https://administrativo.ro/api/push/livreaza
#     404 = CORECT aici: ruta răspunde, dar apelul n-are secret.
#     502 = containerul nu răspunde.
#     curl: (7) = ai nimerit o adresă la care nu ascultă nimeni.

# (c) Chemarea reală, a timerului — singura care dovedește lanțul întreg
journalctl -u push-livrare -n 20 --no-pager
#     Așteptat: `push: HTTP 200`, la fiecare minut.
#     `push: HTTP 404` = secretul din /etc/administrativo/push.env nu se
#     potrivește cu cel ajuns în container. Cel mai probabil ai sărit pasul 4,
#     sau ai generat două valori diferite.
```

Când (c) arată `200`, lanțul e închis: de acolo încolo, o notificare pusă în
coadă pleacă spre telefon în cel mult un minut.

## Ce vezi în raport

Răspunsul rutei e un JSON pe care îl scrie `golesteCoada`:

```json
{
  "luate": 0,
  "trimise": 0,
  "esuate": 0,
  "abandonate": 0,
  "jetoaneRetrase": 0,
  "curatate": 0,
  "inCoada": 0
}
```

`inCoada` e adâncimea cozii DUPĂ rulare. Un număr care urcă de la un minut la
altul înseamnă că sosesc mai multe decât pleacă — singurul semnal care
distinge „nu e nimic de trimis" de „nu se golește". Corpul se scrie în jurnal
doar la eșec, ca să nu umple `journalctl` cu sute de `{"luate":0}` pe zi.

## REGES, separat

`REGES_CRON_SECRET` lipsește și el din `.env.production`, iar
`reges-reconciliere.timer` n-a fost instalat niciodată. Unitatea a fost
reparată azi (adresa era imposibilă, secretul ajungea în `ps`), dar **instalarea
ei e o decizie separată** — ține de ciclul REGES-Online, nu de notificări.
Pașii sunt aceiași, cu `reges.env` în loc de `push.env`.

Începând de azi, `./administrativo.sh stack:deploy` avertizează când oricare
din cele două secrete e gol, cu ce anume tace din cauza lui.
