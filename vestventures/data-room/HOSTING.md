# Getting a shareable https URL for the data room

The application form has one field, **Data room URL**. It needs a link that
an investor can open without an account. Below are three ways to get one,
with exact steps, and a recommendation.

## What goes into the data room, and what never does

Upload only investor-facing files:

| Section | Files (paths relative to `vestventures/`) |
| --- | --- |
| 1 Overview | `pitch-deck.pdf`, `business-plan.pdf`, `roadmap.pdf` |
| 2 Product | `product-mockups.pdf`, the folder `assets/capturi/` (19 JPG screenshots) |
| 3 Financials | `financial-model.xlsx` |
| 4 Legal | The legal documents as they arrive (articles of association, trade register certificate, CUI certificate, IP assignment, beneficial owner statement, terms of service PDF) |
| 5 Market research | `business-plan.pdf` again (its market and competition sections and the sources appendix), or a shortcut to it |
| Index | `00 READ ME FIRST.pdf`, a PDF print of `data-room/index.html` (Drive, see step 4), or `data-room/README.md` imported into Notion (option B), or `data-room/index.html` itself (option C) |

**Never upload**:

- `_surse/fapte.md`: internal fact sheet, including weaknesses phrased for us.
- `_surse/vestventures.md`: our research about the investor.
- `_surse/piata.md`: internal research note. It has positioning advice for
  us, UNVERIFIED rows, repository paths, and an illustrative SOM (600 firms,
  €360k ARR) that contradicts the model's base case (284 firms, €179k ARR).
  The investor-facing version of the same sources is the business plan.
- `_surse/cifre.json` and `model/`: they cite internal files (`fapte.md`,
  `vestventures.md`, `piata.md`, `src/…`) that the reader cannot open. The
  XLSX financial model carries the same numbers with live formulas.
- `form-answers.md`, `README.md` (the Romanian one), `media/`, `tema/`, `tools/`.
- Any PDF that still contains `[TO CONFIRM]` (see the check below).
- Identity documents and criminal records. These go to the fund directly at
  due diligence, never into a link-shared folder.

Before uploading, check the PDFs: `pdftotext <file>.pdf - | grep -c "TO CONFIRM"`
must print 0 for each one. The XLSX financial model is the exception: it uses
`[TO CONFIRM]` to label open assumptions, and those markers may stay. Its
notes cite only public sources or the founders' own estimates (internal file
names were removed on 6 Oct 2026).

---

## Option A — Google Drive folder (recommended)

1. Open https://drive.google.com with the company Google account (not a
   personal one, so the link survives if a founder leaves).
2. **New → New folder**, name it `ADMINISTRATIVO – Data room`.
3. Inside it, **New → New folder** five times: `1 Overview`, `2 Product`,
   `3 Financials`, `4 Legal`, `5 Market research`.
4. Drag the files from the table above into their folders. For screenshots,
   drag the whole `assets/capturi` folder into `2 Product`. For the index,
   do **not** upload `README.md`: Drive shows a `.md` file as raw text with
   Markdown syntax and dead links. Instead, open `data-room/index.html` in
   Chrome or Firefox, press **Ctrl+P → Save as PDF** (the page has a print
   style: no menu bar, no gallery, white background), and upload the PDF at
   the top level as `00 READ ME FIRST.pdf`. Its links are relative and won't
   click through in Drive, but the descriptions still explain each file.
   (Alternative: **New → Google Docs**, paste the text of `README.md`, and
   name the doc `00 READ ME FIRST`.)
5. Do **not** open the XLSX files with "Open with Google Sheets" and save.
   That creates a converted copy. Drive's own preview is enough, and the
   download stays the original file with its formulas.
6. Right-click the top folder → **Share → Share**. Under **General access**,
   change "Restricted" to **Anyone with the link**, role **Viewer**. Leave
   downloading on, because investors want the XLSX. Click **Copy link**,
   then **Done**.
7. Open the link in a private (incognito) window. You should see all five
   folders without signing in.
8. Paste the link into the **Data room URL** field **without** the leading
   `https://`. The form's field already shows an `https://` prefix, so the
   copied link would become `https://https://…`. Check the field once you
   have pasted it.

To revoke access later, set General access back to "Restricted". The link
stops working immediately.

Limits: Drive gives no per-viewer analytics outside your own Workspace.
Anyone who has the link can forward it.

## Option B — Notion page

1. In Notion, **New page**, title `ADMINISTRATIVO – Data room`.
2. Optional shortcut: **Import → Text & Markdown**, and choose
   `data-room/README.md`. You get the headings and descriptions. Then delete
   the relative links, which point nowhere in Notion.
3. Under each section heading, type `/file` and upload the PDF and XLSX
   files. For screenshots, use `/image` once per file, or a 3-column layout.
4. **Share → Publish → Publish**. Turn **off** "Search engine indexing" and
   leave "Allow editing" off. Click **Copy link**: it ends in `notion.site`.
5. Open it in a private window to check, then paste the link into the form.

Limits: on Notion's Free plan each uploaded file can be at most **5 MB**, so
a pitch deck close to the form's 10 MB limit will not upload. A published
page is public to anyone with the link. Unpublish it with the same **Publish**
tab.

## Option C — password-protected page on administrativo.ro

This serves `data-room/index.html` together with the files it links to,
behind a username and password. It uses the shared nginx on the VM, which
serves about ten sites. Follow the steps exactly. The vhost file's own
comments explain why each rule matters.

1. **Copy the investor-facing files** into a folder that nginx can already
   see. `/srv/apps/Strawboss/nginx/conf.d` is bind-mounted into
   `strawboss-nginx-1` as `/etc/nginx/conf.d`. nginx only loads `*.conf`
   files from it, so a subfolder is never parsed as config. Using it means
   **no new mount and no container restart**. A restart would take all
   sites down.

   ```bash
   DEST=/srv/apps/Strawboss/nginx/conf.d/dataroom-vv
   mkdir -p "$DEST"
   cd /srv/apps/ERP/vestventures
   rsync -a --relative \
     data-room/index.html pitch-deck.pdf business-plan.pdf roadmap.pdf \
     product-mockups.pdf financial-model.xlsx \
     assets/capturi/ "$DEST/"
   # keep it out of the Strawboss repository, which tracks conf.d
   echo "nginx/conf.d/dataroom-vv*" >> /srv/apps/Strawboss/.git/info/exclude
   ```

2. **Create the password file.** Put it next to the folder, not inside it,
   so it can never be downloaded:

   ```bash
   docker run --rm httpd:2.4-alpine htpasswd -nbB investor 'A-LONG-RANDOM-PASSWORD' \
     > /srv/apps/Strawboss/nginx/conf.d/dataroom-vv.htpasswd
   ```

3. **Add two locations to the vhost source**,
   `/srv/apps/ERP/deploy/nginx/30-administrativo.ro.conf`. Put them inside
   the `server { listen 443 ssl; server_name administrativo.ro; … }` block,
   just above `location / {`:

   ```nginx
   # Data room for investors (Vest Ventures application), basic auth.
   # No add_header here: one add_header inside a location silently drops the
   # five server-level security headers (HSTS etc.) for this path.
   location = /data-room/ {
       return 302 /data-room/data-room/index.html;
   }
   location /data-room/ {
       auth_basic           "ADMINISTRATIVO data room";
       auth_basic_user_file /etc/nginx/conf.d/dataroom-vv.htpasswd;
       alias                /etc/nginx/conf.d/dataroom-vv/;
       autoindex            on;          # the screenshots folder link lists its files
       charset              utf-8;
       expires              -1;          # Cache-Control: no-cache, so Cloudflare does not cache the files
   }
   ```

4. **Install it.** This command backs up the live vhost, runs `nginx -t`,
   and reloads only if the test passes:

   ```bash
   cd /srv/apps/ERP && ./administrativo.sh nginx:vhost
   ```

5. **Test**:

   ```bash
   curl -sI https://administrativo.ro/data-room/data-room/index.html | head -1   # expect 401 (no password)
   curl -sI -u investor:'A-LONG-RANDOM-PASSWORD' \
     https://administrativo.ro/data-room/data-room/index.html | head -1          # expect 200
   curl -sI -u investor:'A-LONG-RANDOM-PASSWORD' \
     https://administrativo.ro/data-room/pitch-deck.pdf | head -1                # expect 200
   ```

   Then open https://administrativo.ro/data-room/ in a private window, log in,
   and click every link once.

6. **Fill in the form.** URL: `https://administrativo.ro/data-room/`. Give the
   username and password in the form's notes field, or send them to
   hello@vestventures.vc.

7. **Commit** the change to `deploy/nginx/30-administrativo.ro.conf`, using
   the usual `git commit --only` ritual from `CLAUDE.md`. The repository file
   is the source of truth for the live vhost.

To update a file later, copy it again into `$DEST`. No reload is needed. To
remove the data room, delete the two locations, run `nginx:vhost` again, then
`rm -r "$DEST" "$DEST.htpasswd"`.

Limits: an automated screener, such as the Pynn platform behind the form,
cannot open a password-protected link. Only humans who receive the password
can. This option also changes production infrastructure.

---

## Recommendation: Option A, Google Drive

- **It opens without a password**, so the human reviewers can read it, and
  the automated screener (Vest Ventures' first selection level uses an AI
  scoring tool) *may* be able to as well. Nothing shows that the screener
  fetches the data room URL, and Drive folder pages are rendered with
  JavaScript, so automated reading is unreliable. **Everything the screener
  must see goes in the uploads** (pitch deck, financial model, Other files);
  the data room is supplementary. A password (option C) would block the
  screener for certain.
- **It handles our file sizes.** Option B's free plan caps uploads at 5 MB.
- **It previews PDF and XLSX in the browser** and keeps the original files
  for download.
- **It does not touch the nginx that serves about ten other sites.**
- **It can be revoked in one click.**

Use option C later, at due diligence, if the fund asks for a controlled
room. By then the folder will also hold the legal documents, which is a
reason to want a password.
