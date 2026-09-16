# Kay Kay Nails — setup guide

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
- **Backups:** the in-app "Export backup" button in the Clients tab still
  works and downloads a JSON snapshot any time.
- **Home screen shortcut:** once deployed, open the Vercel link on her
  phone's browser and use "Add to Home Screen" the same way we discussed
  for the Claude-hosted version.
