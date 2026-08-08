# Veritax Technical Shape

Last updated: August 6, 2026

## 1. Product Summary

Veritax is currently a transfer-pricing Local File workflow application with a real backend-backed core and several adjacent demo surfaces.

The real product path is Local File generation. It lets a practitioner create an engagement, define the taxpayer scope, upload supporting materials, assess whether jurisdiction requirements are supported by evidence, draft a Local File only when the evidence gates are satisfied, and then run a risk review over the completed draft.

The rest of the application - Compliance, Monitoring, and Defense - exists as product-direction UI. Those pages are seeded/demo interfaces and are currently greyed out in the live app because they do not yet have full backend functionality. They show where the product can go, but the supported live workflow is Local File.

The most important product principle now embedded in the app is:

> Veritax should not manufacture a Local File when the evidence is not there.

That principle drives the strict Requirements gate, citation validation, draft blocking, and risk workflow.

## 2. Repository Shape

Top-level application:

- `app/` - Next.js App Router entry points.
- `components/` - Frontend UI and workflow screens.
- `lib/` - Frontend API client, error diagnostics, seeded demo data, Supabase client.
- `backend/` - FastAPI backend, database models, routers, pipeline jobs, LLM/retrieval logic.
- `jurisdiction_requirements.json` - Top-level requirement seed file.
- `backend/app/data/jurisdiction_requirements.json` - Backend requirement seed file used by the API.
- `render.yaml` - Render backend service blueprint.
- `DEPLOY.md` - Deployment instructions.
- `veritax-landing/` - Landing page project folder.
- `sampleDocs/` - Local sample document set for pipeline testing.

The frontend and backend live in the same repository, but they deploy separately:

- Frontend: Vercel.
- Backend: Render Docker web service.
- Database: Supabase Postgres with pgvector.

## 3. Frontend Architecture

The frontend is a Next.js 16 / React 19 app. The main page is `app/page.tsx`, which is a client component and acts as the application shell.

Primary frontend dependencies:

- `next`, `react`, `react-dom`
- `@supabase/supabase-js` and `@supabase/ssr`
- `lucide-react` for icons
- `recharts` for charts
- `marked`, `react-markdown`, `remark-gfm` for draft rendering
- `@fullcalendar/*` for demo calendar/compliance surfaces

The UI uses local design-system primitives under `components/ui/`:

- `button.tsx`
- `input.tsx`
- `textarea.tsx`
- `select-control.tsx`
- `segmented-control.tsx`
- `tag-input.tsx`
- `indicator.tsx`
- `transition.tsx`
- `action-modal.tsx`

No major external component library is used for app UI beyond small primitives and chart/calendar libraries.

## 4. Main App Shell

`app/page.tsx` owns the global shell:

- Left sidebar.
- Local File project library.
- Workflow navigation.
- Project URL synchronization.
- Backend health boot check.
- Session sign-out.
- Actionable error modal.

The Local File workflow has four steps:

1. Planning
2. Requirements
3. Draft
4. Risks

Planning is canonicalized to `/`.

Other steps are represented through query params:

- `/?project=<engagement-id>`
- `/?project=<engagement-id>&step=requirements`
- `/?project=<engagement-id>&step=draft`
- `/?project=<engagement-id>&step=risks`

The app also stores the latest engagement and step in localStorage:

- `veritax.engagementId`
- `veritax.step`

The URL is now the more important source of shareable state, while localStorage is used as a convenience fallback.

## 5. Auth Model

The frontend signs users in with Supabase.

Every backend data request includes the Supabase access token as:

```text
Authorization: Bearer <access-token>
```

The backend verifies the token in `backend/app/auth.py`.

Supported token verification paths:

- Supabase asymmetric JWT verification through JWKS.
- Legacy HS256 verification through `SUPABASE_JWT_SECRET`, if configured.

Backend routes include `Depends(get_current_user)`, and ownership is enforced by checking `engagement.user_id`.

Health endpoints are public:

- `GET /health`
- `GET /ready`
- `GET /health/db`

## 6. Local File Workflow

### 6.1 Planning

Frontend component:

- `components/steps/planning.tsx`

Backend routes:

- `POST /engagements`
- `GET /engagements`
- `GET /engagements/{id}`
- `PATCH /engagements/{id}`
- `POST /engagements/{id}/documents`
- `DELETE /documents/{document_id}`
- `GET /jurisdictions`
- `GET /connectors`
- `POST /engagements/{id}/sources`

Planning captures:

- Entity name.
- Website URL.
- Jurisdictions.
- Selected source classes.
- Uploaded documents.
- Connected/reference source stubs.

Supported source kinds:

- `financials`
- `agreements`
- `public`
- `interview`
- `supplement`

The app now rehydrates source classes and document names from the backend. It does not need to fetch full file text just to display Planning.

Upload behavior:

- Files are uploaded to the backend.
- Backend stores object bytes.
- Backend creates `Document` rows.
- Backend enqueues indexing jobs.
- Frontend shows upload/indexing state.
- Failed documents open an actionable modal with retry/remove/replacement paths.

The upload size cap is 50 MB per file.

### 6.2 Document Ingestion And Indexing

Core files:

- `backend/app/ingest.py`
- `backend/app/processing.py`
- `backend/app/storage.py`
- `backend/app/embeddings.py`
- `backend/app/jobs.py`

Indexing flow:

1. Store upload metadata and bytes.
2. Compute `content_hash`.
3. If another embedded document has the same hash, reuse its chunks.
4. Extract text.
5. If a PDF text layer is too thin, try OCR.
6. Chunk text.
7. Embed chunks.
8. Store chunks in Postgres with pgvector.
9. Mark document `embedded`.

Document statuses:

- `uploaded`
- `embedding`
- `embedded`
- `failed`

OCR:

- Normal text extraction runs first.
- OCR runs only for scanned/near-empty PDFs.
- OCR uses `ocrmypdf` with Tesseract.
- OCR runs with one worker thread to reduce memory pressure.
- OCR writes sidecar text for embedding rather than persisting a new OCR PDF.
- If OCR tooling is unavailable or OCR fails, indexing keeps the current clear failure path.

Storage:

- Default production behavior is local filesystem storage on Render.
- The uploaded bytes are only required until indexing finishes.
- After indexing, downstream stages read document chunks from Postgres.
- S3/R2 can be enabled by setting `S3_*` variables.

### 6.3 Requirements

Frontend component:

- `components/steps/requirements.tsx`

Backend routes:

- `POST /engagements/{id}/coverage?jurisdiction=...`
- `GET /engagements/{id}/coverage?jurisdiction=...`
- `POST /coverage/{coverage_id}/supplements`
- `POST /coverage/{coverage_id}/satisfied`

Core backend files:

- `backend/app/routers/coverage.py`
- `backend/app/assessment.py`
- `backend/app/coverage_readiness.py`
- `backend/app/evidence_quality.py`
- `backend/app/requirements.py`
- `backend/app/corpus.py`

Requirements are generated from jurisdiction seed data. A coverage row is created per requirement and jurisdiction.

Coverage statuses:

- `pending`
- `present`
- `partial`
- `missing`
- `conditional`
- `failed`

Each coverage row stores:

- Requirement key.
- Element name and description.
- Required/conditional status.
- Verified/source status.
- What is present.
- What is missing.
- Confidence.
- Error.
- Evidence pointers.

Requirements wait for documents to finish indexing before assessment starts. This avoids assessing against empty or half-indexed context.

By default, only the first selected jurisdiction auto-runs. Other jurisdictions start when selected.

### 6.4 Evidence Gate

Draft readiness is strict.

Current behavior:

- Required rows must all be `present`.
- Pending rows block Draft.
- Failed rows block Draft.
- Missing rows block Draft.
- Partial rows block Draft.
- Present ratio threshold is 100 percent.
- Critical gates block Draft with explicit reasons.

Critical Local File concepts include things like:

- Method selection.
- Tested party.
- Controlled transactions.
- Comparables.
- Economic analysis.
- Arm's-length support.
- Financial schedules.

This means the system should refuse to draft when source material is public/background only, wrong entity, wrong jurisdiction, or missing transaction-level evidence.

Manual satisfy:

- Users can mark a non-conditional requirement satisfied.
- This is treated as a practitioner assertion.
- It can unlock readiness if all other gates are satisfied.
- Conditional rows cannot be manually satisfied.

Supplements:

- Users can add text or upload a supplement to a specific requirement.
- Supplements become source material.
- Affected draft sections are invalidated and regenerated as needed.

### 6.5 Draft

Frontend components:

- `components/steps/draft.tsx`
- `components/steps/DraftDocument.tsx`

Backend routes:

- `POST /engagements/{id}/draft?jurisdiction=...`
- `GET /engagements/{id}/draft?jurisdiction=...`
- `GET /engagements/{id}/draft.docx?jurisdiction=...`
- `PATCH /draft-sections/{section_id}`
- `POST /draft-sections/{section_id}/regenerate`

Core backend files:

- `backend/app/routers/draft.py`
- `backend/app/drafting.py`
- `backend/app/docx_export.py`

Draft structure:

- One `DraftSection` per required requirement.
- Sections have statuses: `pending`, `drafting`, `drafted`, `failed`.
- Each section stores content, tables, charts, citations, model, and error.
- Tables/charts are structured JSON and referenced from markdown-like content markers.

The Requirements list is the document structure. Draft does not invent a separate table of contents.

Draft behavior:

- Draft can only start when coverage readiness passes.
- Drafting is section-based.
- If a section fails validation, drafting stops rather than continuing to manufacture a damaged document.
- Draft text is persisted in Postgres.
- Typing animation is frontend-only and intended only for first-time generation.
- On hard refresh, existing drafted content should load in full rather than replaying the type effect.

Draft UI:

- Shows country/jurisdiction chips.
- Shows A4 page-style document sheets.
- Shows a section sidebar with active-section highlighting.
- Keeps the sidebar visible during generation.
- Shows per-section pending/drafting/drafted/failed states.
- Includes edit and Word download controls once the draft is complete.

Docx export:

- Export is blocked unless all expected sections are drafted.
- Export is blocked if any drafted section lacks citations.
- The generated Word file includes a clean cover page and section content.

### 6.6 Draft Quality Controls

Draft validation happens in `backend/app/routers/draft.py`.

Current validation checks include:

- Model returned non-empty content.
- Citations exist.
- Inline citation markers exist in content.
- Every inline marker has a matching citation record.
- Every citation record is used in the content.
- Substantive factual sentences have citations.
- Numeric claims must appear in cited source quotes.
- Table/chart markers must correspond to returned structured objects.
- Document citations must point to uploaded documents.
- Quoted source text must be long enough and appear in the retrieved source text.

The backend rejects sections that fail these checks and stores human-readable error messages for the frontend.

### 6.7 Risks

Frontend component:

- `components/steps/risks.tsx`

Backend routes:

- `POST /engagements/{id}/risks?jurisdiction=...`
- `GET /engagements/{id}/risks?jurisdiction=...`

Core backend files:

- `backend/app/routers/risks.py`
- `backend/app/risks.py`

Risks run only after Draft is complete.

Risk analysis produces:

- Findings.
- Severity.
- Kind: discrepancy or exposure.
- Evidence.
- Recommendations.
- Verification status for evidence.

Risk findings can link back to source text when document evidence is available.

Risks have additional frontend logging because risk loading had performance issues and needed observability.

## 7. Demo And Future Pages

The app contains three future-facing product pages:

- Compliance
- Monitoring
- Defense

Files:

- `components/compliance.tsx`
- `components/monitoring.tsx`
- `components/defense.tsx`
- `lib/compliance-data.ts`
- `lib/monitoring-data.ts`
- `lib/defense-data.ts`

These pages are currently seeded/demo UI. They are useful for showing product direction, but they are not backend-backed live workflow pages.

Live app behavior:

- The sidebar shows them greyed out/disabled.
- Local File is the supported backend-backed path.

### Compliance

Compliance is a seeded obligation register. It shows obligations, status bands, filters, owners, due dates, and links toward Requirements.

### Monitoring

Monitoring is a seeded position-watch view. It shows watched tax positions, status logic, line charts, boundaries, projections, and a detail panel.

### Defense

Defense is a seeded audit-case workspace. It shows open/closed cases, questions, response drafts, timelines, exhibits, and export-pack concepts.

## 8. Backend Architecture

The backend is FastAPI with async SQLAlchemy.

Main entry:

- `backend/app/main.py`

The backend starts by:

1. Initializing database tables.
2. Applying idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` updates.
3. Seeding connector metadata.
4. Choosing storage.
5. Choosing embedder.
6. Choosing LLM provider.
7. Starting the in-process pipeline worker.

Routers:

- `engagements.py`
- `documents.py`
- `sources.py`
- `connectors.py`
- `coverage.py`
- `draft.py`
- `risks.py`
- `pipeline.py`
- `search.py`

Provider selection:

- If `LLM_PROVIDER` is set, it controls the provider.
- If blank, backend auto-selects DeepSeek if `DEEPSEEK_API_KEY` exists.
- Else Anthropic if `ANTHROPIC_API_KEY` exists.
- Else fake providers for dev/test.

Embedding provider:

- Voyage if `VOYAGE_API_KEY` exists.
- Fake embedder otherwise.

## 9. Data Model

Primary tables:

- `entities`
- `engagements`
- `engagement_jurisdictions`
- `sources`
- `documents`
- `document_chunks`
- `connectors`
- `connector_selected_files`
- `requirement_coverage`
- `coverage_evidence`
- `coverage_supplements`
- `draft_sections`
- `draft_citations`
- `risk_runs`
- `risk_findings`
- `risk_evidence`
- `risk_recommendations`
- `pipeline_jobs`

Core relationships:

```text
User
  -> Engagement
    -> Entity
    -> Jurisdictions
    -> Sources
      -> Documents
        -> DocumentChunks
    -> RequirementCoverage
      -> CoverageEvidence
      -> CoverageSupplement
    -> DraftSections
      -> DraftCitations
    -> RiskRuns
      -> RiskFindings
        -> RiskEvidence
        -> RiskRecommendations
    -> PipelineJobs
```

Postgres is both the system of record and the job queue.

## 10. Pipeline Jobs

Pipeline jobs live in `pipeline_jobs`.

Job kinds:

- `index_document`
- `assess_requirements`
- `draft_jurisdiction`
- `analyze_risks`

Job statuses:

- `queued`
- `running`
- `succeeded`
- `failed`
- `blocked`

The worker is intentionally small:

- It claims one runnable job.
- Runs it.
- Marks success/failure.
- Sleeps briefly when idle.

HTTP endpoints enqueue durable jobs, and FastAPI `BackgroundTasks` are used only as a wake-up nudge. The durable source of truth is Postgres.

Recovery:

- Startup adopts old `uploaded` or `embedding` documents.
- Stale `running` jobs are recovered after a timeout.
- `POST /engagements/{id}/pipeline/recover` can restart stale/failed pipeline work.
- Transient failures retry with backoff.
- Action-required document failures become blocked.

## 11. Retrieval And Evidence

Retrieval lives mainly in:

- `backend/app/corpus.py`
- `backend/app/evidence_quality.py`

The pipeline uses pgvector search over embedded document chunks.

Retrieval queries are scoped with:

- Entity name.
- Jurisdiction.
- Requirement description.
- Evidence-quality hints.

Documents are retrieved for:

- Requirements assessment.
- Draft generation.
- Risk analysis.

The system is deliberately source-grounded:

- Requirements store evidence pointers.
- Draft stores per-section citations.
- Risk findings store evidence records.

## 12. Error Handling

Frontend error handling is centralized around:

- `lib/actionable-errors.ts`
- `components/ui/action-modal.tsx`

The app avoids full-width red/orange banners for user-action failures. Instead it uses a small modal with:

- Title.
- Plain-language message.
- Optional detail.
- Primary action.
- Optional secondary action.
- Optional diagnostics payload.

The error system can classify:

- Network/browser fetch failure.
- Backend unreachable.
- Backend healthy but database not ready.
- Auth/session problems.
- CORS/browser blocker issues.
- API status errors: 401, 404, 409, 413, 422, 429, 500+.

Retry behavior:

- Transient errors can retry automatically.
- Recovery can call the pipeline recovery endpoint.
- User-action problems route the user to the right step or action.

## 13. Deployment Shape

Frontend:

- Deployed on Vercel.
- Intended production domain: `app.veritaxai.com`.
- Needs `NEXT_PUBLIC_API_BASE_URL`.
- Needs Supabase public config in `.env.local`/Vercel env.

Backend:

- Deployed on Render as Docker service.
- Blueprint: `render.yaml`.
- Dockerfile: `backend/Dockerfile`.
- Health check: `/health`.
- Readiness check: `/ready`.

Database:

- Supabase Postgres.
- Requires pgvector extension.
- `DATABASE_URL` should use asyncpg-compatible URL.

Current Render blueprint notes:

- Backend is on free plan.
- Free plan can cold start.
- OCR adds CPU/memory pressure.
- OCR is configured to run with one worker to reduce memory spikes.

Important env vars:

- `DATABASE_URL`
- `DEEPSEEK_API_KEY`
- `VOYAGE_API_KEY`
- `ANTHROPIC_API_KEY` if Anthropic is used
- `LLM_PROVIDER`
- `CORS_ORIGINS`
- `SUPABASE_URL`
- `SUPABASE_JWT_SECRET` if legacy HS256 is needed
- `OCR_ENABLED`
- `OCR_COMMAND`
- `OCR_LANGUAGE`
- `OCR_TIMEOUT_SECONDS`
- `OCR_MIN_TEXT_CHARS`
- optional `S3_*` storage variables

## 14. Testing

Backend tests are under `backend/tests`.

Current coverage includes:

- Auth.
- Engagements.
- Documents.
- Processing/chunking/OCR fallback.
- Search.
- Requirements/coverage.
- Coverage readiness.
- Drafting and structured draft output.
- DOCX export.
- Risks.
- Error handling.
- Pipeline recovery and job behavior.

The most recent backend run passed:

```text
92 passed
```

Frontend validation is through:

```text
pnpm build
```

## 15. Known Product Boundaries

Local File is real. The other pages are not yet backend-backed.

The app does not yet connect to SAP, Oracle, SharePoint, or accounting systems. Connectors are modeled, but not fully wired as production ingestion paths.

The backend does not run Celery, Redis, or an external worker. Postgres is the queue, and the worker runs in-process inside the FastAPI service.

The schema uses SQLAlchemy `create_all` plus idempotent column updates rather than Alembic migrations.

Uploaded bytes are not guaranteed durable unless S3/R2 is configured. The design assumes bytes are needed only until indexing completes.

OCR improves scanned document indexing, but it does not solve wrong-entity, wrong-jurisdiction, stale, or insufficient evidence.

The Requirements gate is intentionally strict. This can block Draft on imperfect evidence, but that is the desired quality posture.

The LLM can still fail a section because of citation validation, malformed output, provider timeout, or insufficient retrieved source context. When that happens, the section is failed and the pipeline stops instead of generating a contaminated file.

## 16. Current Product Posture

Veritax is now best described as:

> An evidence-backed Local File workflow that can ingest source documents, assess requirement completeness, refuse unsupported drafts, generate sectioned cited drafts when evidence is sufficient, export Word output, and run a risk review over completed files.

The app is no longer just a clickable demo. The Local File path is a working application path. The key remaining work is deepening evidence ingestion and structured fact capture so the app can satisfy hard transfer-pricing requirements without relying on generic public documents.

## 17. Most Important Next Technical Moves

1. Add structured planning fields for legal entity, fiscal year, taxpayer ID, tested transactions, counterparties, and controlled-transaction classes.
2. Add source-type rules per requirement, so group annual reports cannot satisfy entity-level transaction requirements.
3. Add explicit transaction ledger import and counterparty mapping.
4. Add benchmarking-study ingestion as a first-class source type.
5. Add source-scope validation before retrieval: entity, jurisdiction, fiscal year, and document type.
6. Add a durable external worker if Render memory or long-running OCR/LLM work becomes unreliable.
7. Wire real connectors for file repositories and accounting data.
8. Convert Compliance, Monitoring, and Defense from seeded UI to backend-backed modules only after Local File evidence quality is stable.
