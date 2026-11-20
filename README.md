# Kay Kay Nails — setup guide

## Updating to version 2 (already live? start here)

Do these in order. The first step must come first.

1. **Update the database (once).** In Supabase open **SQL Editor > New query**,
   paste everything from `supabase-migration-v2.sql`, click **Run**. It says
   "Success". Safe to run twice.
2. **Copy the new files.** Unzip the update over your `kaykay-app` folder
   and choose "Replace" if asked. Your `.env` and `.git` are not touched.
3. **Push it live:**
   ```
   git add -A
   git commit -m "Version 2"
   git push
   ```
   Vercel updates the site in about a minute.
4. **Keep the database awake (optional, recommended).** In GitHub open your
   repo > **Settings > Secrets and variables > Actions > New repository secret**
   and add two secrets: `SUPABASE_URL` (your Project URL) and
   `SUPABASE_ANON_KEY` (the anon public key). Then open the **Actions** tab,
   pick "Keep database awake" and click **Run workflow** once to test it.
   It then pings the database every 3 days so Supabase's free plan never pauses it.
5. **Get the new icon.** On her phone, delete the old home-screen shortcut,
   open the site again and use "Add to Home Screen" (Share button on iPhone,
   menu on Android). It now opens full screen with the new icon.

What's new: week total fixed, new client + booking saved safely, no
1,000-booking limit, failed saves are undone with a message, prices are
remembered per booking, Restore backup button and 14-day backup reminder,
auto-refresh when reopening, app icon and full-screen mode, opens on the
Calendar, and Bookings jumps to today / the next booking.

---

This is the hosted version of the app: a real database (Supabase) instead
of Claude's storage, hosted for free on Vercel, with auto-deploy from
GitHub so future updates are just `git push`.

## 1. Set up Supabase (the database)

1. Go to https://supabase.com, sign up (free), and create a new project.
   Pick any name/region/password — you won't need the password day-to-day.
2. Once the project is ready, open **SQL Editor** in the left sidebar →
   **New query**.
3. Open `supabase-setup.sql` (in this folder), copy its entire contents,
   paste into the SQL editor, and click **Run**. This creates the three
   tables and pre-fills them with your real client list and service menu.
4. Go to **Project Settings > API**. You'll need two values from this
   page in a minute:
   - **Project URL**
   - **anon public** key

## 2. Run it locally first (recommended, to make sure it works)

You'll need [Node.js](https://nodejs.org) installed (any recent version).

```bash
cd kaykay-app
npm install
cp .env.example .env
```

Open the new `.env` file and paste in your Project URL and anon key from
step 1.4. Then:

```bash
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`) and confirm the
app loads with your clients and services already there.

## 3. Push it to GitHub

1. Create a free account at https://github.com if you don't have one.
2. Create a new repository (any name, e.g. `kaykay-nails`). Leave it
   empty — don't add a README or .gitignore from GitHub's side.
3. In your terminal, inside the `kaykay-app` folder:

```bash
git init
git add -A
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/kaykay-nails.git
git push -u origin main
```

(Replace the URL with the one GitHub shows you after creating the repo.)

## 4. Deploy on Vercel, with auto-deploy

1. Go to https://vercel.com and sign up using your GitHub account (this
   auto-connects the two).
2. Click **Add New > Project**, and select the `kaykay-nails` repo you
   just pushed.
3. Vercel auto-detects it's a Vite project — you don't need to change the
   build settings.
4. Before deploying, expand **Environment Variables** and add:
   - `VITE_SUPABASE_URL` → your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon key
5. Click **Deploy**. After a minute you'll get a live link like
   `kaykay-nails.vercel.app`.

That's it — **auto-deploy is already on** by default. From now on, any
time this code changes and gets pushed to the `main` branch on GitHub,
Vercel automatically rebuilds and updates the live site within a minute
or two, with no manual redeploy step.

## 5. Making future changes

When you want a new feature or fix, the flow is:

1. I give you the updated file(s).
2. Replace the file(s) in your local `kaykay-app` folder.
3. In your terminal:

```bash
git add -A
git commit -m "describe what changed"
git push
```

4. Vercel picks it up automatically — check the Vercel dashboard or just
   reload the live site after ~1 minute.

## Notes

- **No login/password on the app itself.** Anyone with the live link can
  view and edit the data. That's fine for a private link only she uses,
  but if you ever want to lock it down further, that's a separate
  feature (Supabase Auth) we can add later.
- **Backups:** the Clients tab has **Export backup** and **Restore backup**.
  Only restore a file exported from this live app. The app reminds you
  every 14 days.
- **Home screen shortcut:** once deployed, open the Vercel link on her
  phone's browser and use "Add to Home Screen" the same way we discussed
  for the Claude-hosted version.
