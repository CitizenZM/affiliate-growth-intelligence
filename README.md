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

This project supports Supabase for:
- Action Plan CRUD (`action_items`)
- Dataset processing status mirror (`dataset_runs`)
- Metrics / Evidence / AI Sections mirror (`analysis_metrics`, `analysis_evidence_tables`, `analysis_sections`)

1. In Supabase SQL Editor, run:
`supabase/schema.sql`
2. Add env vars in `.env.local`:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

If Supabase env vars are missing, the app falls back to Base44 storage automatically.

### Acceptance checks (Supabase + realtime)

1. Upload a new dataset in Input.
2. Confirm `dataset_runs` receives a row for the dataset and `status/progress/processing_step` updates during processing.
3. Confirm `analysis_metrics`, `analysis_evidence_tables`, and `analysis_sections` are populated after processing.
4. Open Overview/Concentration/MixHealth/Efficiency/Approval/OperatingSystem/Timeline and verify values/sections update without refreshing to stale data.
5. Re-upload a second dataset and verify all metrics/conclusions differ according to new input.

### Deploy

- Vercel preview deploy:
`npx vercel deploy -y`
- Production deploy:
`npx vercel deploy --prod -y`
