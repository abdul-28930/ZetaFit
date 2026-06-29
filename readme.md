# ZetaFit

> **Gym management SaaS for independent fitness centres in India.**
> Built by [ZetaLabs](https://zeta-labs.dev) — the first product in a fleet of vertical SaaS tools for Indian SMEs.

---

## What it does

Most small Chennai gyms run on a WhatsApp group for reminders, a paper register for attendance, and cash collected at the front desk with no receipt. They lose renewal revenue silently because nobody follows up on expiring memberships.

ZetaFit fixes three things:

| Problem | Solution |
|---|---|
| Members lapse silently | Auto-WhatsApp reminder 3 days before expiry |
| No check-in system | QR code or phone number → ALLOWED / BLOCKED in one tap |
| No GST receipts | Auto-generated invoice on every payment |

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router) + Tailwind CSS v4 |
| Backend | FastAPI on Oracle Cloud Always Free |
| Database | Supabase (Postgres + Auth + Storage + RLS) |
| Payments | Razorpay |
| WhatsApp | BSP — AiSensy / Interakt / Wati |
| Hosting | Vercel (frontend) + Oracle Cloud (backend) |
| Auth | Supabase Auth — email/password (owner) + Google OAuth (member) |

---

## Features

### Owner portal
- **Dashboard** — live KPI cards, recent check-ins, expiring members this week
- **Members** — add, search, filter by status/plan, view profile
- **Plans** — create membership plans with features, pricing, GST
- **Payments** — record cash/UPI/card, stat cards, filter by status
- **Attendance** — phone number search with ALLOWED/BLOCKED result, today's log
- **Reports** — plan distribution, revenue trend, expiry forecast, CSV export
- **Settings** — gym profile, QR code, operating hours, GST number

### Member portal
- Google OAuth sign-in
- Subscription progress ring with days remaining
- Attendance heatmap by month
- Payment history
- QR scanner to check in daily

### QR system
- Every gym gets a unique 7-character code (e.g. `IRONB42`)
- Members scan to join the gym (one-time email verification)
- Same QR used for daily attendance — scan → ALLOWED/BLOCKED instantly
- Downloadable QR card for printing at the gym entrance

---

## Project structure

```
zetafit/
├── app/
│   ├── (owner pages)
│   │   ├── dashboard/
│   │   ├── members/
│   │   ├── plans/
│   │   ├── payments/
│   │   ├── attendance/
│   │   ├── reports/
│   │   └── settings/
│   ├── member/
│   │   ├── home/
│   │   ├── plan/
│   │   └── attendance/
│   ├── join/[code]/         ← gym QR join + daily check-in
│   └── api/                 ← route handlers
├── components/
│   ├── sidebar.tsx
│   ├── member-layout.tsx
│   ├── gym-qr.tsx
│   ├── qr-scanner.tsx
│   └── time-range-picker.tsx
├── lib/
│   └── supabase/
│       ├── client.ts        ← browser client
│       └── server.ts        ← server client (SSR-safe)
├── supabase/
│   └── migrations/
│       └── 2026-06-26-v1.sql
└── middleware.ts             ← auth protection + route guards
```

---

## Database

Full schema in `supabase/migrations/2026-06-26-v1.sql`.

Key tables:

```
organizations      → each gym is one tenant
profiles           → extends Supabase auth.users
membership_plans   → Basic / Standard / Premium per gym
members            → gym members with auth link
member_subscriptions → active/expired plan assignments
payments           → cash/UPI/card transactions with GST split
attendance         → check-in log with allow/block result
jobs               → async job queue (no Redis needed)
```

Row Level Security is enabled on every table. Org isolation is enforced at the database layer via `current_org_id()` helper — never just in the frontend.

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-org/zetafit.git
cd zetafit
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database

Run `supabase/migrations/2026-06-26-v1.sql` in your Supabase SQL Editor.

Then seed your first gym:

```sql
-- Run after creating your auth user in Supabase → Auth → Users
DO $$
DECLARE
  v_user_id UUID := 'your-auth-user-uuid-here';
  v_org_id UUID;
BEGIN
  INSERT INTO organizations (name, slug, city, state, platform_plan, platform_status)
  VALUES ('Your Gym Name', 'your-gym', 'Chennai', 'Tamil Nadu', 'starter', 'trial')
  RETURNING id INTO v_org_id;

  INSERT INTO profiles (id, organization_id, full_name)
  VALUES (v_user_id, v_org_id, 'Your Name')
  ON CONFLICT (id) DO UPDATE SET organization_id = v_org_id;

  INSERT INTO user_roles (user_id, role_id, organization_id)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000002', v_org_id);

  INSERT INTO whatsapp_credits (organization_id, balance, monthly_grant)
  VALUES (v_org_id, 200, 200);

  INSERT INTO membership_plans (organization_id, name, duration_days, price, gst_rate, features, is_popular)
  VALUES
    (v_org_id, 'Basic', 30, 999, 18, '["Gym access","Locker room"]', false),
    (v_org_id, 'Standard', 90, 2499, 18, '["Gym access","Locker room","Group classes"]', true),
    (v_org_id, 'Premium', 180, 4999, 18, '["Unlimited access","Personal trainer","Diet consultation"]', false);
END;
$$;
```

### 4. Google OAuth (for member portal)

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client
2. Authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
3. Supabase → Auth → Providers → Google → paste Client ID + Secret

### 5. Run

```bash
npm run dev
```

Owner portal → `localhost:3000/login`
Member portal → `localhost:3000/member/login`

---

## Deployment

### Vercel (frontend)

```bash
npm install -g vercel
vercel --prod
```

Set environment variables in the Vercel dashboard.

### Oracle Cloud (FastAPI backend)

Coming in Phase 7 (WhatsApp integration). The frontend works standalone — FastAPI is only needed for WhatsApp sends and GST invoice PDF generation.

---

## Pricing

| Plan | Price | Members | WhatsApp/month |
|---|---|---|---|
| Starter | ₹999/mo | 250 | 200 messages |
| Growth | ₹1,999/mo | 600 | 600 messages |
| Pro | ₹3,499/mo | Unlimited | 2,000 messages |

14-day free trial · No card required · Annual = 2 months free

---

## Roadmap

- [x] Owner portal — dashboard, members, plans, payments, attendance, reports, settings
- [x] Member portal — home, plan, attendance, QR check-in
- [x] QR system — gym code, join flow, daily attendance
- [ ] WhatsApp reminders (Phase 7)
- [ ] GST invoice PDF (Phase 7)
- [ ] Edit member / renew subscription
- [ ] Vercel production deploy
- [ ] Workout builder + public share page
- [ ] Razorpay subscription billing

---

## Team

| Role | Person |
|---|---|
| Founder · Backend · Infra | Abdul Salam — [ZetaLabs](https://zeta-labs.dev) |
| Architect · Frontend · UI | Aslam |

---

## License

Private — © 2026 ZetaLabs. All rights reserved.
End
