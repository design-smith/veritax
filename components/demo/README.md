# Demo step views

Home for the prefilled, static replicas of the workflow steps (Planning / Requirements / Draft / Risks)
rendered by the public `/demo` route ([app/demo/page.tsx](../../app/demo/page.tsx)).

These are **display-only** — no `lib/api`, no Supabase, no data fetching — so `/demo` renders for logged-out
visitors with zero network calls. Populate with canned content in a later step.
