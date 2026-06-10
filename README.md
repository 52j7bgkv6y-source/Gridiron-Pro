# Gridiron Pro — Cloud (Step 1: accounts, teams & roles)

This is the foundation of the hosted site: a real **email + password login**, an
**access-code gate**, **teams** (one per school/squad), the four **roles**
(Admin / Co-Admin / Coach / Player), and **invites**. Each team's data is walled
off from every other team. The playbook editor itself gets dropped in at Step 2.

It's two pieces:
- **Supabase** — the free backend (login + database + per-team security).
- **index.html** — the website. Drop it on any free static host.

Everything below is click-by-click. No coding needed.

---

## 1. Create the backend (Supabase) — ~5 min

1. Go to **supabase.com** → sign up (free) → **New project**. Pick a name and a
   database password (save it somewhere). Wait ~2 min for it to spin up.
2. Left sidebar → **SQL Editor** → **New query**. Open **schema.sql** from this
   folder, copy *everything*, paste it in, and click **Run**. You should see
   "Success." (You can re-run it safely anytime.)
3. Left sidebar → **Project Settings → API**. Copy two things:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long string under "Project API keys")
4. *(Recommended for an easy start)* Sidebar → **Authentication → Sign In / Providers
   → Email** → turn **Confirm email** OFF → Save. This skips the confirmation
   email so sign-up logs people straight in. (If you leave it ON, new users just
   confirm via email, then log in — their access code is remembered either way.)

## 2. Put it online — ~2 min

**Fastest (to test it now):** go to **app.netlify.com/drop** and drag the whole
`gridiron-cloud` folder onto the page. You get a live URL instantly.

**For "update whenever I want" (recommended long-term):**
1. Make a free **GitHub** account → create a repo → upload this folder.
2. In **Netlify** (or **Cloudflare Pages**) → "Add site → Import from GitHub" →
   pick the repo. Done.
3. From then on, editing the code and **pushing to GitHub auto-updates the live
   site** — no re-uploading.

## 3. Connect it to your backend — ~1 min (no file editing)

Open your live site. The first screen is **Connect to your backend**. In
Supabase → **Project Settings → API**, copy your **Project URL** and the
**anon public** key, paste them into the two boxes, and click **Connect**.

That's it — it's remembered on your device and the screen turns into the login.
Both values are safe to put here (your data is protected by the database rules,
not by hiding the key). Mistyped one? There's a small **change backend** link at
the bottom of the screen to redo it.

## 4. Become the first admin — ~1 min

1. Open your live site → **Sign Up**.
2. Enter your email, a password, your name, and the access code **`GRIDIRON1`**
   (this founder code came pre-loaded by the schema).
3. You're now the **Admin** of a new team called "My School." Rename it later.
4. Tidy up: in Supabase → SQL Editor, you can delete the starter code so it
   can't be reused: `delete from invite_codes where code = 'GRIDIRON1';`

> Want to set up several schools yourself? In SQL Editor, mint another founder
> code anytime:
> ```sql
> insert into invite_codes (code, role, new_team_name, max_uses)
> values ('CENTRAL24', 'admin', 'Central High', 1);
> ```
> Give `CENTRAL24` to that school's head coach; they sign up and become its admin.

## 5. Invite your staff and players

On the dashboard (as Admin or Co-Admin):
1. Under **Invite someone**, pick a role and click **Create code**.
2. Copy the 8-character code and send it to that person.
3. They **Sign Up** with it and land on your team in that role.

What each role can do (enforced in the database, not just the screen):
- **Admin** — everything; assigns roles; invites; the only one who can remove/demote the Admin.
- **Co-Admin** — everything the Admin can do **except** remove or demote the Admin.
- **Coach** — edits the playbook.
- **Player** — views the playbook (exports hidden — wired up with the editor in Step 2).

---

## What's next (Step 2)

The full field editor moves inside this shell:
- Loads/saves to **this team's** private library in the database (so one team's
  edits are never seen by another, and **app code updates never wipe a team's plays**).
- Each team starts with the shared **Default** playbook; the old "Mine" tab goes away.
- **Backup / Download** stays on the Default tab.
- Players get view-only with exports hidden; coaches and up can edit and export.
- Your Varsity / JV / Fresh-Soph tagging and filter carry straight over.

When you've got this deployed and you've signed up as the admin, tell me and I'll
start wiring the editor into it.

---

### Troubleshooting
- **"Connect to your backend" screen** → paste your Project URL + anon key there (Step 3), then Connect.
- **"That code is not valid"** → typo, or the code was already used (codes are single-use by default).
- **Sign-up says check your email** → email confirmation is ON; confirm, then log in (your code is saved and auto-applies).
- **Can't see other teams' data** → correct, and intended. Each team only ever sees its own.
