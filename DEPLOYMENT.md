# Deployment Guide — Radha Krishna Book Depo Closing Sale

Path from local development to a live site on Vercel.

## 1. Prerequisites

- A Supabase project with the database set up (see below)
- A GitHub account (Vercel deploys from a Git repository)
- A Vercel account (free Hobby tier is fine for a closing sale)

## 2. Supabase — production checklist

If you are reusing the development project, skip to step 3. For a fresh
production project:

1. Create the project (choose the region closest to your customers).
2. SQL Editor → run **`supabase/setup_all.sql`** (or the individual files
   `migrations/0001…0005` in order) — **without** `seed.sql` for production,
   or run `supabase/reset_demo_data.sql` later to wipe demo data.
   **Existing project?** Run `supabase/migrations/0005_branding.sql` once —
   it is idempotent: it adds the `sale_subtitle`, `legacy_badge`,
   `thank_you_message` and `sale_days` settings and replaces old demo text
   (shop name, headline, message) without touching values you already edited.
3. Storage bucket `product-images` is **created automatically (as public) on the
   first image upload** from Admin → Products. If you create it manually in
   Storage → New bucket, you must enable **Public bucket** — a private bucket
   makes every product image 404 for customers (the app repairs this on the
   next upload, but only then).
4. Authentication → Users → **Add user** (the shopkeeper's email + password,
   tick auto-confirm). Then SQL Editor:
   ```sql
   insert into admin_users (user_id)
   select id from auth.users where email = 'OWNER-EMAIL-HERE';
   ```
5. Note down from **Settings → API**: Project URL, publishable/anon key,
   secret/service-role key.

## 3. Push the code to GitHub

```bash
git remote add origin https://github.com/YOUR-USER/closing-sale.git
git push -u origin master
```

`.env.local` is git-ignored — secrets never leave your machine.

## 4. Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → import the
   GitHub repository. Framework is auto-detected (Next.js).
2. Under **Environment Variables**, add exactly these three:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service-role / secret key |

3. **Deploy.** First build takes a couple of minutes.
4. Open the deployed URL → the customer site should load. Check
   `/admin` → sign in with the shopkeeper account.

## 5. Configure the business (in the app, not in code)

Admin → **Settings**:
- Shop name (Radha Krishna Book Depo), sale headline (CLOSING SALE) &
  sub-headline (Heavy Discount SALE), legacy badge, farewell message,
  thank-you message, sale days (ONLY ON SATURDAY & SUNDAY)
- **WhatsApp number** (digits with country code — order messages go here)
- Minimum order value, low-stock threshold
- Shop address (replace the seed's Mathura placeholder with the real address)
  & timings, payment/collection instructions, final-sale terms

Admin → **Products / Offers / Locations**: real catalog (CSV import for
bulk), gift tiers, collection points with date/time slots.

## 6. Go-live checklist

- [ ] `supabase/migrations/0005_branding.sql` run on existing projects — the
      four hero fields appear in Admin → Settings
- [ ] Hero text reviewed: correct shop name, no "Everything Must Go", no
      discount percentages; real Mathura shop address entered
- [ ] **Share this sale** tested: *Share on WhatsApp* opens with the message,
      *Copy message* works, policy line intact
- [ ] Demo data removed (`supabase/reset_demo_data.sql`) — this also resets
      order numbering
- [ ] Real products with images and stock quantities entered
- [ ] WhatsApp number set and tested (place one test order end-to-end)
- [ ] Minimum order + gift tiers configured
- [ ] At least one **Confirmed** collection location with a slot
- [ ] Admin password is strong; only trusted people in `admin_users`
- [ ] `node scripts/verify.mjs` passes against the production project
      (creates and cleans up its own ZZTEST data)

## 7. Operating during the sale

- Orders arrive on WhatsApp AND in Admin → Orders (database is the truth).
- Workflow per order: **Confirm** when you see it → **Ready** when packed →
  **Collected & paid** at handover. **Cancel/Expire** no-shows to release
  their stock for other customers.
- Watch Dashboard → low stock; adjust inventory with reasons (audited).
- Export a CSV of all orders any time from Reports.

## Notes

- Free Supabase projects pause after ~1 week with zero traffic. During the
  sale this won't happen; before launch, just open the dashboard to wake it.
- Custom domain: Vercel project → Settings → Domains (optional).
- To add another admin later: create the user in Supabase Auth, then insert
  their id into `admin_users` (same SQL as step 2.4).
