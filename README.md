# Hello World Admin

Week 6: an admin panel for the [Hello World](../README.md) caption and meme
app. It's a separate Next.js app on its own Vercel project, sharing the main
app's Supabase database and Google sign-in. Only users whose
`profiles.is_superadmin` is `true` can get past the login page.

| Route          | What it does                                                                 |
| -------------- | ---------------------------------------------------------------------------- |
| `/`            | Dashboard: KPIs and week-over-week trends, 30 days of activity, when people vote (day × hour heatmap), the sign-up → regular funnel, AI captions vs. memes, which vibe and which caption position wins, Gemini models, hall of fame, awards, top locations |
| `/users`       | **Read** every user: Google email, name, sign-in dates, posts, votes cast, 👍 received. Search and sort |
| `/users/[id]`  | One user's profile, photos, memes and recent votes                            |
| `/media`       | **Read** every AI photo and its captions. Search, filter by vibe or user, sort by votes or find unvoted ones |
| `/media/new`   | **Create** an AI photo: upload, pick a vibe, and let Gemini write the captions (or write them yourself) |
| `/media/[id]`  | **Update** a photo's location and vibe, reword, add or remove captions, see the exact prompt. **Delete** the photo with its captions, votes and image |
| `/memes`, `/memes/[id]` | Moderate memes: edit the text, make one members-only, delete it      |
| `/votes`       | **Read** every 👍/👎 (who, on what, when), and the ratings: captions and memes ranked by score |
| `/login`, `/auth/callback`, `/denied` | The only pages open without being a superadmin           |

## Keeping everyone else out

The panel can read every profile and vote and delete anyone's post, so it is
checked four times:

1. **[`proxy.ts`](proxy.ts)** runs before every request. Signed out → `/login`.
   Signed in but `is_superadmin()` isn't true → `/denied`. It allow-lists the
   three public pages, so a page added later is protected by default. (Link
   prefetches skip the database check; the page they fetch makes it anyway.)
2. **Every page** calls `requireAdmin()` from [`lib/auth.ts`](lib/auth.ts)
   before loading anything. The proxy is a fast first check, not the only one.
3. **Every Server Action** calls `requireAdmin()` again. Actions are public
   POST endpoints, and a page's check doesn't cover them.
4. **The database** decides in the end. The admin policies in
   [`supabase/admin.sql`](supabase/admin.sql) all require
   `is_superadmin()`, so even a request that slipped past the app would get
   nothing. The app uses the signed-in user's own session, never the service
   role key.

The database also limits what an admin can change. Column privileges allow
only a photo's location and vibe, a caption's text and a meme's text and
members-only flag. Vote totals still only change through votes, and authors,
prompts and dates can't be rewritten. Triggers keep the server's time on
votes and sign-ups, so nobody can backdate a vote to skew the dashboard.

The session cookie is HttpOnly (the panel never calls Supabase from the
browser) and has its own name, so on localhost it doesn't collide with the
main app's.

### "Won't I be locked out?"

Yes, at first: the flag is required to get in, and the panel can't set it.
Users can't either. Everyone may update their own `profiles` row (name,
photo), so a trigger rejects any change to `is_superadmin` that comes from
the app's roles (`anon`, `authenticated`). Without it, anyone could make
themselves an admin from the browser console with the public anon key.

The way in is the **Supabase SQL Editor**. It runs as the `postgres` role, so
RLS doesn't apply and the trigger lets it through. Step 8 of `admin.sql`
makes you the first superadmin:

```sql
update public.profiles
   set is_superadmin = true
 where id in (select u.id
                from auth.users u
               where lower(u.email) = lower('you@gmail.com')
                 and u.email_confirmed_at is not null
                 and u.raw_app_meta_data -> 'providers' ? 'google');
```

It matches on `auth.users`, not `profiles.email`. Users can edit their own
`profiles` row, so someone could set their profile's email to yours just
before you run this and become an admin too. It also only matches a
confirmed account that signed in with Google. Supabase's email sign-up is on
by default, so someone could register your address with a password without
ever confirming it. Since both apps only use Google, consider turning the
Email provider off under Authentication → Sign In / Providers. Run the same
statement again to add admins, or set the flag to `false` to remove one.

## Setup

### 1. Database

In the Supabase SQL Editor, after the main app's files, run
[`supabase/admin.sql`](supabase/admin.sql). Put your Google email in step 8
first, or edit and run just that statement afterwards. Sign in with Google
once before running it (to either app), so you have a profile. The file is
safe to re-run. Its last result lists the superadmins: expect your email.

### 2. Supabase Auth

Authentication → URL Configuration → Redirect URLs: add
`http://localhost:3001/auth/callback` and the admin deployment's
`https://<admin-domain>/auth/callback`. If the existing
`https://*-<vercel-team-slug>.vercel.app/auth/callback` wildcard already
covers the admin project's URLs, there's nothing to add for previews. The
Google OAuth client doesn't change: Google redirects to Supabase, not to
the app.

### 3. Vercel

Add New → Project → import this same repository again, and set **Root
Directory** to `admin`. Then:

- Settings → Environment Variables:

  ```
  NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon or publishable key>
  GEMINI_API_KEY=<same key as the main app>       # for /media/new
  GEMINI_MODEL=                                   # optional
  NEXT_PUBLIC_MAIN_APP_URL=https://<main-app-domain>  # optional: "View in app" links
  ```

- Settings → Deployment Protection → turn off Vercel Authentication, so the
  login page opens in an incognito window. The panel still needs a superadmin
  Google account.

The app has no imports from outside `admin/`, so it also works copied into a
repository of its own.

## Development

```bash
cd admin
npm install
npm run dev -- -p 3001
```

Put the same variables in `admin/.env.local`. The main app can run on port
3000 at the same time.
