# ADMINISTRATIVO — 90-second product demo: script and shot list

Purpose: a short screen-recorded walkthrough for the **Media URLs** field of
the investor application. It shows only flows that exist in the product
today, as verified in `_surse/fapte.md`. Voice-over is in English. The
application's interface is in Romanian, so every shot gets an English
caption.

Target length **90 seconds**. The voice-over is 201 words, which is about
83 seconds at a calm 145 words per minute and leaves a few seconds of
breathing room. Subtitles with the same timings are in
`demo-video.en.srt`.

---

## Before recording

- **Use only the demo company** "Administrativo Demo SRL" (8 fictitious
  employees), the same company the screenshots in `assets/capturi/` come
  from. Never record a real company: no real names, no national ID numbers
  (CNP), no salaries.
- **Desktop**: browser window at 1280×800 (or 1920×1080 at 150% zoom), with
  bookmarks bar and extensions hidden. Sign in as the demo company's
  `org_admin`. **Phone**: Android screen recorder, portrait, signed in as one
  demo employee in the portal (browser or installed web app).
- **REGES-Online shot (shot 6)**: do **not** press the transmit button from
  the demo company. Transmission goes to the Labour Inspectorate's live API.
  Show the event list and an event's detail, and **stop before sending**.
  The only REGES screenshot (`assets/capturi/reges.jpg`) shows the API
  settings tab, because the demo company is deliberately not connected; check
  that the demo company has at least one prepared event before you record
  [TO CONFIRM].
- **Company switcher (shot 8)**: switching companies only works if the demo
  login is a member of a second company. Check that before you record
  [TO CONFIRM the demo user belongs to two companies]. If it does not, cut
  the switcher from shot 8 and from voice-over line 8.
- **Do not show or say** things the product does not do:
  - location tracking (GPS) at clock-in
  - badge or card readers
  - announcements targeted at one department, or with attachments
  - REGES "retrying by itself"
  - announcements sent by e-mail
  - payroll described as certified or production-ready. It is "in validation
    with an accountant".
- Record the voice-over separately, in a quiet room, then lay it over the
  screen clips. Captions: white text on a navy (#0E1B2E) bar, bottom third.
  Accent colour #2563EB.

---

## Shot list

| # | Time | Dur. | Screen (route) | What happens on screen | English caption |
| --- | --- | --- | --- | --- | --- |
| 1 | 0:00–0:07 | 7 s | Title card (navy #0E1B2E) | Text animates in: "526,000 Romanian employers. Daily hours. Every hire reported." | Romania, 2026 |
| 2 | 0:07–0:12 | 5 s | Title card | ADMINISTRATIVO wordmark, tagline below | HR and payroll for Romanian SMEs, in one app |
| 3 | 0:12–0:22 | 10 s | **Phone**: camera on the QR poster → `/portal/ponteaza/<code>` → `/portal` | The employee scans the work-location poster, the clock-in screen opens, one tap; the portal card switches to "Am intrat" (clocked in) | Clock in by scanning the poster at work |
| 4 | 0:22–0:32 | 10 s | **Desktop**: `/pontaj` (month view) | Scroll the monthly timesheet; hover on an overtime cell; click approve, then lock the month | Monthly timesheet: approve and lock |
| 5 | 0:32–0:42 | 10 s | **Phone** `/portal/concediile-mele` → **desktop** `/concedii/aprobari` → `/concedii/calendar` | Employee submits a leave request; manager approves it; the team calendar shows the absence; the balance has updated | Leave: request, approve, balance updates itself |
| 6 | 0:42–0:56 | 14 s | **Desktop**: `/angajati/<id>` → `/reges` → `/reges/<id>` | From a (fictitious) employee's file, open REGES-Online: the hire event waits in the queue, with its legal deadline; open the event detail. **Stop before transmitting.** | REGES-Online: filed over the official API |
| 7 | 0:56–1:04 | 8 s | **Desktop**: `/ssm/instruiri` | Pan across the briefing matrix: green, amber, red and "never done" cells | Health & safety: who is due, who is overdue |
| 8 | 1:04–1:14 | 10 s | **Desktop**: `/salarizare/<id>` → account menu → company switcher | Show an approved payroll period and its export buttons (accounting note, D112 file, SEPA bank file); then open the account menu and switch to another company without signing out | For accountants: exports and one login for all clients |
| 9 | 1:14–1:22 | 8 s | **Desktop**: quick cuts of `/flota`, `/inventar`, `/onboarding`, `/cursuri`, with the full sidebar visible | Three fast cuts, one second of hold each, sidebar visible | 19 modules, switched on per company |
| 10 | 1:22–1:30 | 8 s | End card (navy) | Price and URL appear | From 149 lei (~€30) / month per company, up to 20 employees · first month free · administrativo.ro |

Total: 7 + 5 + 10 + 10 + 10 + 14 + 8 + 10 + 8 + 8 = **90 s**.

---

## Voice-over (English)

Read at an even pace. Each line belongs to the shot with the same number.

1. *(0:00)* "Every Romanian employer must record each employee's working hours,
   every day, and report every hire to the labour inspectorate."
2. *(0:07)* "ADMINISTRATIVO does it in one app, starting from the employee's
   phone."
3. *(0:12)* "At work, the employee scans the poster with their phone and
   clocks in. One tap, no paper."
4. *(0:22)* "The manager sees the monthly timesheet fill itself in, with
   overtime and night hours, and approves it. The administrator locks the
   month."
5. *(0:32)* "Leave requests follow the company's approval chain. Balances
   update themselves, and the team calendar shows who is away."
6. *(0:42)* "Hire someone or change a salary, and the event is ready for
   REGES-Online, the national employee register, with its legal deadline. It
   is filed over the official API, and the answer comes back to the
   employee's file."
7. *(0:56)* "Health and safety briefings show as a traffic light: who is due,
   who is overdue, and who never had one."
8. *(1:04)* "Accountants get the payroll exports, the tax-return file and the
   bank file, and one login for all their client companies. Payroll is now
   in validation with an accountant."
9. *(1:14)* "Fleet, inventory, onboarding, courses: each company gets only the
   modules it needs."
10. *(1:22)* "One flat price per company, from 149 lei a month, and the first
    month is free. administrativo.ro."

---

## Facts behind each line (for the founders, not for the video)

| Shot | Claim | Source |
| --- | --- | --- |
| 1 | 526,000 employers; daily start/end record; REGES-Online reporting | `_surse/piata.md` §a.1, §b.1, §b.3 |
| 3 | QR poster clock-in on the phone | `_surse/fapte.md` §1 (attendance), screenshot `portal-scanare.jpg` |
| 4 | Monthly timesheet, overtime and night hours, approval (manager, own team), month locking (administrator only: `attendance:approve` with scope `all`, `blocheazaPerioada` in `src/app/(app)/pontaj/actions.ts`) | `_surse/fapte.md` §1 (attendance) |
| 5 | Approval chain, automatic balance, team calendar | `_surse/fapte.md` §1 (leave) |
| 6 | Events from the employee record, queue, filing over the API, answers reconciled back, deadlines | `_surse/fapte.md` §5 |
| 7 | Briefing matrix with traffic light, "never done" ≠ "expired" | `_surse/fapte.md` §1 (ssm) |
| 8 | Accounting note, D112 XML, SEPA file; company switcher; payroll in validation | `_surse/fapte.md` §1 (payroll), §3, §10 |
| 9 | 19 modules, enabled per company | `_surse/fapte.md` §1 |
| 10 | 149 RON (≈ €30 at 5 RON = 1 EUR)/month core, up to 20 employees, first month free | `_surse/fapte.md` §2 |

## Export settings

MP4 (H.264), 1920×1080, 30 fps, AAC audio at 48 kHz. Keep the file under
200 MB. Upload it as described in `media/README.md`, together with
`demo-video.en.srt` as English subtitles.
