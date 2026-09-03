# Umami pe `analitice.administrativo.ro`

Măsurare fără cookie-uri, pe VM-ul propriu. Rulează lângă aplicație, în același
Swarm și pe aceeași rețea `strawboss-net`, în spatele nginx-ului partajat.

**De ce, când există deja GA4.** GA4 e sub consimțământ — cookie-urile de analiză
nu intră în excepția de „strict necesare". Majoritatea vizitatorilor nu apasă
„Accept", deci GA4 raportează o felie. Umami nu scrie cookie-uri și nu urmărește
oameni între site-uri, deci nu cere consimțământ și numără pe toată lumea.

---

## Pornirea, o singură dată

Toate comenzile se dau pe VM, din `/srv/apps/ERP`.

### 1. Secretele

```bash
export UMAMI_DB_PASSWORD="$(openssl rand -hex 24)"
export UMAMI_APP_SECRET="$(openssl rand -hex 32)"
printf 'UMAMI_DB_PASSWORD=%s\nUMAMI_APP_SECRET=%s\n' \
  "$UMAMI_DB_PASSWORD" "$UMAMI_APP_SECRET" >> .env.production
```

> `APP_SECRET` semnează sesiunile panoului. Se generează **o dată** și nu se mai
> schimbă: o valoare nouă deconectează pe toată lumea.

### 2. Certificatul, ÎNAINTE de vhost

Ordinea nu e opțională. Blocul `443` din vhost referă un certificat care încă nu
există, iar `nginx -t` ar cădea — ceea ce blochează reload-ul **tuturor**
site-urilor de pe VM, nu doar al acestuia.

Merge fără vhost fiindcă nginx n-are `default_server`: gazda nepotrivită cade pe
primul bloc `:80` încărcat (`10-nortiauno.com.conf`), care servește deja
`/.well-known/acme-challenge/`.

```bash
docker compose --project-directory /srv/apps/Strawboss run --rm \
  --entrypoint certbot certbot \
  certonly --webroot -w /var/www/certbot \
  -d analitice.administrativo.ro \
  --agree-tos --no-eff-email --non-interactive -m contact@administrativo.ro
```

Verifică:

```bash
docker exec strawboss-nginx-1 test -f \
  /etc/letsencrypt/live/analitice.administrativo.ro/fullchain.pem && echo OK
```

### 3. Stack-ul

```bash
docker stack deploy -c deploy/umami/docker-stack.yml umami
docker service ls --filter name=umami
```

Așteaptă până când ambele servicii arată `1/1`. Prima pornire durează, fiindcă
Umami își face schema.

### 4. Vhost-ul

```bash
cp deploy/nginx/31-analitice.administrativo.ro.conf /srv/apps/Strawboss/nginx/conf.d/
docker exec strawboss-nginx-1 nginx -t && docker exec strawboss-nginx-1 nginx -s reload
```

> `nginx -t` **înainte** de reload, mereu. Un vhost stricat oprește toate
> site-urile de pe VM, nu doar pe ăsta.

### 5. Contul și identificatorul sitului

Deschide `https://analitice.administrativo.ro`. Utilizator implicit `admin`,
parolă `umami` — **schimb-o la prima intrare**.

Apoi: _Settings → Websites → Add website_, cu domeniul `administrativo.ro`.
Copiază **Website ID** (un UUID).

### 6. Legarea sitului

```bash
printf 'NEXT_PUBLIC_UMAMI_SRC=https://analitice.administrativo.ro/script.js\nNEXT_PUBLIC_UMAMI_ID=<UUID-ul-copiat>\n' >> .env.production
```

Apoi **imagine nouă**, nu doar restart: cele două variabile sunt
`NEXT_PUBLIC_*`, deci se coc în bundle-ul de client la `docker build`, exact ca
`NEXT_PUBLIC_APP_URL`.

```bash
./administrativo.sh deploy
```

Până când variabilele există, `Analitice` nu randează scriptul Umami și nimic nu
se strică — situl merge cu GA4 singur.

---

## Ce NU face configurația asta

- **Nu face copii de siguranță.** Volumul `umami-db` trăiește pe VM. O pierdere
  de disc înseamnă pierderea istoricului de trafic. Dacă cifrele ajung să
  conteze, intră în același plan de backup ca restul.
- **Nu limitează accesul la panou.** Oricine are adresa vede ecranul de login.
  Parola e singura poartă; alege una lungă.
- **Nu e proxat prin Cloudflare.** Recordul `A` e direct pe VM, deci IP-ul de
  origine e vizibil pentru subdomeniul ăsta. Se poate muta în spatele proxy-ului
  oricând, fără schimbări de configurație aici.
