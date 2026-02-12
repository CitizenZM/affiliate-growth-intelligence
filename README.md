## Affiliate Growth Intelligence

### Local development

1. Install dependencies:
`npm install`
2. Create `.env.local` from `.env.example`
3. Start dev server:
`npm run dev`

Required Base44 env:

```bash
VITE_BASE44_APP_ID=your_base44_app_id
VITE_BASE44_APP_BASE_URL=https://your-base44-app.base44.app
```

### Supabase connection (Action Plan)

This project now supports Supabase for Action Plan data (`action_items` table).

1. In Supabase SQL Editor, run:
`supabase/schema.sql`
2. Add env vars in `.env.local`:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

If Supabase env vars are missing, the app falls back to Base44 storage automatically.

### Deploy

- Vercel preview deploy:
`npx vercel deploy -y`
- Production deploy:
`npx vercel deploy --prod -y`
