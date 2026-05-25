# Changelog

All notable changes to **evo-crm-community** (umbrella) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This repository is the umbrella of the CRM Community family: it orchestrates the 7 submodules via Docker Compose. For per-service details, see the `CHANGELOG.md` inside each submodule.

## [Unreleased]

### Added

- N/A

### Changed

- N/A

### Fixed

- N/A

## [v1.0.0-rc4] - 2026-05-25

Release with two main themes: **(1) Evolution Hub** as an optional proxy for Meta channels, exposed end-to-end (admin configuration in the frontend, webhook receiver and inbox builder in the CRM), and **(2) Typebot interactive buttons** across processor / CRM / frontend / widget. Also rolls up MFA hardening in the auth-service (plaintext backup-code remediation post-EVO-991, session cache invalidation after re-setup), licensing fail-open, runtime storage provider, several CRM fixes (single-account assumptions, interactive-message hardening, macro execution status persistence), frontend chat fixes (sidebar scroll, conversation count, loadMore race), and a menu cleanup that hides in-development entries.

### Submodules updated

- **evo-auth-service-community** v1.0.0-rc4 — MFA hardening (EVO-991 plaintext backup-code invalidation migration + EVO-1104 session cache invalidation), licensing fail-open during outages, runtime storage provider (EVO-1050), onboarding survey push.
- **evo-ai-crm-community** v1.0.0-rc4 — Evolution Hub as optional proxy for Meta channels (webhook receiver + InboxBuilder + lifecycle), Typebot interactive buttons, EVO-1088 macro execution status + webhook failure surfacing, EVO-1372 interactive-message hardening, legacy single-account assumption fixes, internal events module groundwork (not user-facing).
- **evo-ai-frontend-community** v1.0.0-rc4 — Evolution Hub admin page + `HubConnectButton`, Typebot interactive buttons in chat and widget, EVO-1088 real macro execution result in UI, `NodeConfigModal` + `JourneyEditorHeader` + `useFlowEditorStore` shared components (groundwork for upcoming features, not user-facing), chat fixes (sidebar scroll, conversation count, loadMore race), menu cleanup hiding in-development entries.
- **evo-ai-processor-community** v1.0.0-rc4 — Typebot interactive button rendering paired with CRM/frontend.
- **evo-ai-core-service-community** v1.0.0-rc4 — no functional changes; tag issued to keep the CRM Community family aligned on a single release-candidate version.

### Notes for upgrading an existing PROD

- **auth-service**: the plaintext backup-code invalidation migration runs `UPDATE` with a row-level lock on the `users` table. For databases with more than 100k users, schedule a short maintenance window. Users that had MFA enabled before this release will be prompted to set up TOTP again on next login (precaution post-EVO-991).
- **crm**: includes a legacy schema cleanup migration. Run `db:migrate` on upgrade. No impact on production data — the removed tables were not in use.
- **frontend**: in-development menu entries are hidden in this release. Routes remain in the app; only sidebar visibility was adjusted. No operator or end-user action required.
- **processor**: no operational changes; image rebuilt with the Typebot rendering update.
- **core-service**: no operational changes; image rebuilt to stay aligned with the family.

## [v1.0.0-rc3] - 2026-05-17

Stabilization release following `v1.0.0-rc2` (2026-05-05). A ~12-day window with ~16 commits in the super-repo and ~165 commits/PRs across the submodules. Predominant focus on **bug fixes** for production issues identified after rc2 — Evolution Go messaging, outbound media, public endpoint hardening, 2FA, RBAC, IDOR scoping, secret filtering in logs — combined with the technical foundation of the open-core (Extension Points across all services + Plugin Host Runtime in the frontend) and two cross-stack features: products catalog and template bundles export/import.

### Highlights

- 🐛 **Massive bug fix release** — 6 main hardening fronts: Evolution Go payload parity (buttons/lists EVO-1115), outbound media delivery (EVO-1151), Notificame verify hardening (EVO-986), bulk actions with IDOR scoping (EVO-1084), secret filtering in Rails logs (EVO-1111), 2FA backup codes hash+500 (EVO-991).
- 🧩 **Complete open-core foundation**: all 5 submodules now declare `EXTENSION_POINTS.md` + no-op modules. The frontend gained a **Plugin Host Runtime** (EVO-1379) that loads external plugins without forking. The auth-service gained `LoginGate` and `TokenClaims` as strict extension points. The CRM gained a CI guard-rail (EVO-1287) that prevents silent contract changes.
- 📦 **Products catalog** — products model with variants, attachable to agents, pipeline integration for sales. Native tools in the processor (`link_product_to_pipeline_item`) and catalog injection into the agent context.
- 📤 **Template bundles export/import (EVO-1116)** — packaging of configuration (inboxes, agents, automation rules, canned responses, templates) into a ZIP portable across installations. Dedicated RBAC permission (`template_bundles.manage`), export wizard in the frontend, i18n pt/es/fr/it.
- 🛡️ **Complete Roles & Permissions UI (EVO-1061)** — custom roles administration screen with full CRUD, `account_owner` scoping, and guard against privilege escalation via delegation of permissions not held.
- 🔌 **Knowledge Nexus integration** — agents can search Nexus spaces directly from the prompt (`knowledge_nexus_search` tool in the processor + space picker in the frontend Agent Builder + proxy endpoint in the core-service).
- 🤖 **Automation rules — consolidation**: `attribute_changed` operator on labels (EVO-1058), `conversation_resolved` / `conversation_status_changed` listeners (EVO-1057), `move_to_pipeline` cross-pipeline action, 5s window dedup, logs panel in the frontend.

### Added

- **Plugin Host Runtime in the frontend (EVO-1379)** — loads external plugins at runtime; foundation for the Enterprise edition to inject features without forking.
- **`EXTENSION_POINTS.md` in all 5 submodules** — versioned public contract for extension points. Auth: `LoginGate` + `TokenClaims`. CRM: 4 hooks + `lib/evo_extension_points/` no-op + CI guard-rail (EVO-1287). Frontend: 4 declared categories (EVO-1284/1378) with Plugin Host Runtime in v2.1.0 (EVO-1387). Core-service: `pkg/evoextensions` with 3 no-op interfaces (EVO-1285). Processor: hooks document (EVO-1376).
- **Products catalog (CRM + frontend + processor)** — model with variants, attachable to agents, sales panel in the pipeline, injection into the agent context, `link_product_to_pipeline_item` tool, `products.*` RBAC permissions.
- **Template bundles export/import (EVO-1116)** — cross-stack feature (CRM + frontend + auth RBAC) to package installation configuration into a ZIP. `template_bundles` resource declared in auth, endpoint in the CRM, export wizard in the frontend with i18n.
- **Roles & Permissions admin UI (EVO-1061)** — full roles management screen in the frontend + CRUD API in the auth-service + `account_owner`/`super_admin` boundary guards + regression spec.
- **Knowledge Nexus integration** — native `knowledge_nexus_search` tool in the processor, space picker in the Agent Builder, proxy endpoint in the core-service.
- **Native tools in the processor LLM agent** — `knowledge_nexus_search`, `manage_conversation_labels`, `link_product_to_pipeline_item`.
- **Automation rules** — `attribute_changed` operator with From/To pickers (EVO-1058), `conversation_resolved` and `conversation_status_changed` listeners (EVO-1057), `move_to_pipeline` action (cross-pipeline), logs panel in the frontend, action service with `send_canned_response` and `send_template`.
- **Bulk actions** — bulk resolve of conversations via checkbox (EVO-1011), response with per-item `success_ids` / `failed_ids`.
- **Pipelines — `move_to_pipeline` action** — automation moves conversation across pipelines preserving id, with 5s window dedup.
- **EVO-1051** — `DELETE` endpoint to clear admin config by type (CRM) + "Clear Configuration" button in Admin Settings (frontend).
- **EVO-1189** — Delete contact action in the frontend.
- **EVO-990** — Pipeline actions available in the 3-dot menu and context menu (right-click).
- **EVO-988** — Contact phone number visible in the conversation list and chat header.
- **EVO-1146 — i18n** — multiple missing keys added across 6 frontend locales; pt/es/fr/it locales added for template bundles.
- **Regression specs** — `pipeline_item` auto-assign-and-move (EVO-1080), Notificame verify (EVO-986), contact with attachments (EVO-973), macro webhooks (EVO-1041), `account_owner`/`super_admin` boundary (EVO-1060), `agent` role permission set (EVO-1060).

### Changed

- **EVO-1049 — SMTP/BMS/Resend applied at runtime in the auth-service** — operator can swap these configs via UI without restarting the container. The frontend dropped the workaround banner (rc2) that asked for a restart.
- **EVO-1113 — Consolidation of Evolution credential resolution in the CRM** — a single concern (`EvolutionConcern`) centralizes per-field fallback for `api_url`/`admin_token`. Reduces bug surface between Evolution API and Evolution Go.
- **EVO-1147 — Provider config polling in the frontend** — Page Visibility API integrated, no polling in background tabs; `provider_config` removed from deps.
- **EVO-1085 — WebSocket reconnection** — active reconnection with success toast + background backoff.
- **EVO-1131 — Large file upload** — skip of fetch+blob, limit raised to 100MB.
- **EVO-1044 — Per-field GlobalConfig fallback detection** — Connection Settings banner now detects field by field.
- **EVO-976 — Avatar storage** (#80, umbrella) — shared volumes, `AUTH_SERVICE_URL` documented, storage docs updated.
- **`EVOLUTION_OPERATOR_EMAIL`** documented in `.env.example` (licensing).
- **Docs / branding** — entire stack standardized to Evolution Foundation 2026 (README, LICENSE, NOTICE, TRADEMARKS); GitHub URLs migrated from `EvolutionAPI` to `evolution-foundation`.
- **Docker tag convention** — fixed in `release.yml` and the umbrella README (no `v` prefix in Docker tags).
- **CI** — workflows now run on PRs against `develop` (not only `main`); Linear/CRM packages with PR link fetched from Linear comments in the `code-review` skill.

### Fixed

#### Messaging — Evolution Go / Evolution API
- **EVO-1115** — buttons/lists payload corrected to the Evolution Go format (parity with Evolution API). Interactive messages were arriving malformed.
- **EVO-1151** — outbound media delivery failure on both providers (Evolution API and Evolution Go).
- **Duplicated messages in the Evolution Go incoming handler** — dedup at the entry point.
- **`api_url` / `admin_token` fallback** — falls back to `GlobalConfig` when the inbox config is empty.

#### Stability / REST API
- **2FA backup codes** (EVO-991, auth) — 500 NoMethodError + plaintext hash in the database. Fixed with BCrypt + null field handling.
- **EVO-1063 — Structured 422 password validation** (auth + frontend) — response with machine-readable codes consumed by an inline checklist in the user creation form.
- **EVO-1046 — `setupRequired=false` default** when `/setup/status` errors out (frontend) — previously a 5xx on setup status blocked the entire app.
- **EVO-1107 — Configuration tab blank/slow load** — skeleton + polling fixed.
- **EVO-1048 — Collapsed sidebar** — submenu flyout and tooltip appear when the sidebar is collapsed.
- **EVO-1145 — Conversation match in reducers** — now matches by `id || uuid`.
- **EVO-1078 / 1054 / 1062 / 1056** — multiple chat and auth bugs resolved in a batch.

#### Webhooks / Notificame
- **EVO-986 — Notificame verify endpoint hardening** — mandatory auth, payload validation, no error leakage; regression spec.
- **EVO-1041 — Macro webhook delivery failures** — failures are now surfaced; re-raise restricted to `:macro_webhook` to avoid retry storms.
- **EVO-1130 — Attachment fallback_title** — prefers `content[:fileName]`.

#### Automation / Pipeline
- **`labels` condition** — `EXISTS` subquery (independent, NULL-safe), resolves UUIDs to titles, matches label on conversation OR contact.
- **`message_type` filter** — accepts numeric values.
- **`apply_label` action** — resolves UUIDs to titles before tagging; opens label picker in the frontend.
- **`pipeline_stage_updated`** — 5s window dedup by `(rule, pipeline_item, stage)`.
- **Cross-pipeline stage movement** — correct bypass of `same-pipeline` validation.
- **Build break** — `MessageTemplateVariable` defined locally.
- **Menu** — duplicate automation item removed.
- **EVO-1018 — Group contacts** — distinguishes WhatsApp group contacts from real contacts (CRM + frontend).
- **EVO-998** — orphan contact event files and dead i18n removed.

#### RBAC
- **EVO-1060 — `agent` role** — `pipelines.read` backfilled, `pipelines.update` removed (it would have unlocked destructive endpoints).

#### Media (EVO-999)
- **HIGH review findings** applied: video file_type fallback, attachment fallback_title, force-download via fetch+blob covered on all paths.

#### Other
- **DB asyncpg** (processor) — `sslmode` translated to `ssl` (native driver parameter).
- **Docker bundler** (CRM) — version pinned at install.

### Security

- **EVO-1111 — Secret filtering in Rails logs** (CRM) — sensitive fields (password, token, api_key) filtered before logging.
- **EVO-1084 — IDOR scope in `BulkActionsJob`** (CRM) — account scoping applied; previously it was possible to manipulate cross-tenant resources with a valid ID.
- **EVO-1061 — Privilege escalation via delegation** (auth) — `account_owner` can no longer delegate permissions they do not themselves hold.
- **EVO-986 — Notificame verify** (CRM) — mandatory auth + no error leakage.
- **2FA backup codes** (auth) — codes hashed with BCrypt; previously stored in plaintext in the database.

### Notes for upgrading an existing PROD

- ✅ **`agent` role RBAC changes** are activated automatically via `db:migrate` (EVO-1060) — no reseed required.
- ✅ **SMTP/BMS/Resend runtime** (EVO-1049) — applied automatically after upgrading the auth-service. Operator can swap configs without restart.
- ✅ **Log secret filtering** — activates automatically after upgrading the CRM. Old logs are not affected (only new entries).
- ⚠️ **2FA backup codes** — starting in rc3, codes are stored hashed with BCrypt. Codes generated before rc3 remained in plaintext in the database; if the database history was accessible to anyone outside the installation operator, regeneration via UI is recommended.
- 📝 **`EXTENSION_POINTS.md`** — public contract only; no migration action required. Reactive for the Enterprise edition that injects the implementations.
- 📝 **Per-submodule CHANGELOG** has the full technical detail — this section is the umbrella summary.

## [v1.0.0-rc2] - 2026-05-05

Stabilization release following `v1.0.0-rc1` (2026-04-24). A ~3-week window concentrating ~40 orchestration commits in the super-repo and ~70 PRs across the submodules. Focus on four fronts:

1. **Docker / deterministic setup** — `make setup` on a fresh install works without race conditions between services
2. **Cloud / WhatsApp media** — private S3 buckets, PTT-compatible audio recording, inline video rendering
3. **`super_admin` RBAC** — installation operator separated from `account_owner`, with automatic upgrade on existing PROD
4. **API stability** — elimination of `500 Internal Server Error` on REST endpoints, end-to-end Evolution Go flow fixed

### Highlights

- 🎙️ **WhatsApp Cloud audio finally works in production**: after 4 attempts with FFmpeg WASM (all blocked by SharedArrayBuffer / COOP+COEP requirements / corrupted worker on npm), we pivoted to `opus-recorder@8.0.5` — direct PTT-compatible OGG/Opus recording in the browser, no reencode, no server-side latency.
- 🎬 **Video in chat appears as a player**, no longer as a "Download file" attachment.
- 🗄️ **Media in private buckets works**: signed URLs applied on both the Evolution API and Evolution Go providers.
- 🔐 **New `super_admin` role**: the installation operator has exclusive access to the `/settings/admin` panel (SMTP, Storage, Auth Providers, OpenAI, Channels, Inbound Email). An automatic migration promotes the bootstrap user on existing installations and revokes their active tokens to force re-login with the new role.
- 🧪 **E2E Playwright** validating the audio recording pipeline with a fake microphone — feedback cycle dropped from a 10-minute deploy to 5s locally.
- 🛠️ **Deterministic `make setup`**: full idempotency in Rails service migrations resolves the race condition with `evo-bot-runtime` Go core on `users` table creation.

### Added

- **`super_admin` role** in `evo-auth-service-community` — installation-level operator. Holds all `account_owner` permissions plus `installation_configs.manage` (access to the `/settings/admin` panel). Automatically assigned to the setup wizard user. Existing PROD receives it via `db:migrate` (promotes `User.order(:created_at).first`).
- **`Role::ADMIN_ROLE_KEYS` constant** in the CRM — centralizes `%w[account_owner super_admin]`, adopted by admin mailers and finders. Previously the list was hardcoded in four places and excluded `super_admin`, causing inconsistent behavior in admin bypasses.
- **`user_tours` table** in the auth-service — persistence of onboarding tour state per user.
- **Audio recording E2E suite** in the frontend — Playwright + Chromium with fake media stream. `e2e/audio-recording.spec.ts` validates that `recordPttOgg` produces an `audio/ogg` blob with `OggS` magic bytes in a real browser environment.
- **`MessageVideo` component** in the frontend — inline render with `<video controls preload="metadata" playsInline>`, fallback to a download tile when codec is not supported.
- **"Automation" tab in the Edit Stage Modal** (EVO-989, frontend) + **`Pipelines::StageAutomationService`** (EVO-989, CRM) — `trigger → action` rules per pipeline stage.

### Changed

- **WhatsApp Cloud — audio recording: FFmpeg WASM → `opus-recorder`**. Full saga documented in `evo-ai-frontend-community/CHANGELOG.md`. Summary: the Cloud API requires OGG/Opus PTT; the first solution tried converting webm → ogg in the browser via FFmpeg WASM, but the 4 versions tested failed for distinct architectural reasons (SharedArrayBuffer, 0-byte worker on npm, unconditional worker fetch in the wrapper). Replaced by `opus-recorder@8.0.5`, which captures raw PCM and encodes directly to OGG/Opus via `libopusenc` — no reencode, no cross-origin isolation requirements, no server round-trip.
- **Media in private S3 buckets** (CRM): `generate_direct_s3_url` replaced by `presigned_url` in `whatsapp/providers/evolution_go_service.rb` and `whatsapp/providers/evolution_service.rb`. Previously the direct public URL returned 404 when the bucket was private (Cloudflare R2, S3 with private ACL).
- **Conversation list — `pipeline_items` preload**: `ConversationFinder#build_conversations_query` kept a minimal preload, so the pipeline chip in the listing only appeared after manual tagging. Added `pipeline_items: [:pipeline, :pipeline_stage]` to the preload.
- **Admin Settings UX in the frontend**: "Social Login" renamed to "Authentication Providers" (reflecting generic OAuth, not only social networks), Twitter tab hidden (deprecated provider), "configuration via env" warning banners on SMTP/Storage to make it clear that UI changes do not persist in PROD.
- **CI**: `validate-compose` and `lint-dockerfiles` workflows now run on PRs against `develop` (not only `main`). (#59)
- **Submodules**: coordinated bumps over the rc2 window:
  - `evo-ai-crm-community`: 19 PRs/commits (automation rules EVO-989, navigation EVO-1007, idempotent migrations, end-to-end EvoGo fixes, contact import, super_admin RBAC, signed S3 URLs, etc.)
  - `evo-ai-frontend-community`: 11+ PRs/commits (opus-recorder, inline video, automation UI, role select, team members, brand colors, admin settings UX, e2e Playwright, etc.)
  - `evo-auth-service-community`: super_admin role + automatic upgrade migration with token revocation, password forwarding fix on user creation, full idempotency in init_schema, user_tours table
  - `evo-ai-processor-community`: `python -m` for alembic/uvicorn + idempotency
  - Other submodules: CI adjustments

### Fixed

#### Setup / Docker / Orchestration
- **`Makefile` — database setup sequence**: `make setup` now creates the DB in the CRM, runs `db:schema:load` (loads the master schema, including all tables the auth-service uses), marks auth migrations as applied via `rails runner` with deterministic `.sort` and a specific `rescue ActiveRecord::RecordNotUnique`, and only then runs `db:seed` on the CRM followed by the auth. Without this, `make setup` on a fresh install failed with `PG::UndefinedTable: roles`. (cherry-pick from PR #69 — authorship by @andersonlemesc preserved)
- **Fully idempotent `init_schema` in the auth-service** — a race condition between the auth-service setup and `evo-bot-runtime` Go core (which creates a minimal `users` table on boot) caused `init_schema` to fail with `PG::DuplicateTable` when Go won the race. Rewritten with `if_not_exists: true` on all `create_table`/`add_index` and an `add_fk_if_missing` helper for foreign keys.
- **Docker — `auth_storage`**: named volume replaced with a bind mount, fixing `permission denied` when writing files in the authentication service. Bind mount also extended to `sidekiq` with a defensive `mkdir` in the entrypoint. (#65, #72)
- **Docker — Alpine compat**: swapped `bash -c` for `sh -c` in internal scripts for compatibility with Alpine images. (#31)
- **Docker — healthcheck**: fixed the `evo-core` healthcheck path. (#26)
- **Env validation (EVO-985)**: block `BACKEND_URL` / `FRONTEND_URL` pointing to `localhost` in production — fail fast on boot instead of serving invalid URLs to external clients. (#75)
- **Submodules**: retargeting of orphan SHAs to public branches (`develop` / `main`). Eliminated CI checkout errors caused by lost SHAs.

#### Media / Chat
- **WhatsApp Cloud audio did not reach the recipient** — Meta rejects `audio/webm` as a voice message. Solved by the migration to `opus-recorder` (see Changed above).
- **Video appeared as a "Download file" attachment** — `MessageBubble` was falling into the generic fallback. New `MessageVideo` with a native player.
- **Media in private bucket returned 404** — signed URLs applied on both providers (see Changed).

#### RBAC
- **`super_admin` ignored by CRM bypasses** — hardcoded lists of administrative roles filtered only `account_owner`. `User#administrator?` and `Role::ADMIN_ROLE_KEYS` consolidated recognition; without this, super_admin saw an empty conversation list, admin mailers did not arrive, etc.

#### API stability (CRM, from the `develop` cycle)
- **`PATCH /api/v1/pipelines/:id/pipeline_items/:id/update_custom_fields`** raised `NoMethodError` (before_action skipping the action). (#32)
- **`POST /api/v1/contacts/:id/companies`** raised `NoMethodError` in `must_belong_to_same_account`. (#34)
- **`POST/DELETE /api/v1/contacts/:id/companies`** returned 500 on business rule violation (incompatible kwargs in `error_response`). (#35)
- **`/api/v1/agents/*`** returned 500/Unauthorized (request.headers not forwarded, current_user used as the wrong positional argument). (#33)
- **`GET /api/v1/oauth/applications`** returned an array instead of the standard envelope, breaking the OAuth Apps screen. (#36)
- **EVO-1000** — `POST /api/v1/team_members` returned 401 for every valid UUID (`map(&:to_i)` on a UUID PK). (#24)

#### Evolution Go (EvoGo) — end-to-end WhatsApp flow (#22)
- Conversation routing by LID (no more duplicated conversations on each outgoing send)
- Correct sender type, contact lookup via inbox joins, reopening of pending conversations
- Media saved without a file (3 issues: ActiveStorage commit in Sidekiq, nested `mediaUrl`, inline base64 for EvoGo without S3)
- Audio without waveform (duplicate definitions of `configure_audio_metadata`)
- ActionCable broadcast on empty token

#### Auth-service
- **`POST /api/v1/users` returned 500 without `role`** — fallback to `agent` instead of `Role.find_by!(key: nil)`. (#9)
- **Login always 401 for users created via UI** — `password` was not forwarded to `AgentBuilder.new`, so each agent was born with a random Argon2 hash nobody knew. (commit `917c366`)
- **`add_message_template_permissions_to_account_owner` migration** failed on fresh install with `PG::UndefinedTable: roles` due to timestamp ordering. Added a `table_exists?(:roles)` guard.
- **EVO-971**: `/setup/status` gate now considers bootstrap, not only licensing. (#8)
- **EVO-967**: invited agents are auto-confirmed; role lookup tolerates a missing role without a 500. (#3)

### Notes for upgrading an existing PROD

- ⚠️ **`db:migrate` of `evo-auth-service-community` revokes active tokens of the bootstrap operator** when promoting them to `super_admin`. The operator will be forced to log out/in once on the first request after the upgrade. This is expected and necessary for the JWT to reflect the new role.
- ⚠️ **Other `account_owner` users lose access to the `/settings/admin` panel** — intentional behavior (the panel is reserved for installation operation, not account management). If you created multiple `account_owner` users in rc1 and want more than one of them to have admin access, you will need to promote them manually to the new role via console (`User.find(...).user_roles.create!(role: Role.find_by!(key: 'super_admin'))`).
- ✅ **Media in private S3 bucket**: the signed URL fix is purely backend and activates automatically after upgrading the CRM. No migration action required.
- ✅ **WhatsApp Cloud audio**: active automatically after the frontend upgrade. A hard browser refresh is required to invalidate the old bundle.
- 📝 **Per-submodule CHANGELOG** has the full technical detail for each item — this section is the umbrella summary.

## [v1.0.0-rc1] - 2026-04-24

### Added

- First public release candidate of the **CRM Community**.
- Initial composition of 7 submodules via Docker Compose:
  - `evo-ai-crm-community`
  - `evo-ai-frontend-community`
  - `evo-ai-core-service-community`
  - `evo-ai-processor-community`
  - `evo-auth-service-community`
  - `evo-bot-runtime`
  - `evolution-api`, `evolution-go` (WhatsApp providers)
- `Makefile` with setup, seed, and dashboard targets.
- Bootstrap scripts (`setup.sh`) and `docker-compose` examples (dev, prod-test, swarm).
- `.env` templates and `Apache 2.0` license.

---

[Unreleased]: https://github.com/evolution-foundation/evo-crm-community/compare/v1.0.0-rc4...HEAD
[v1.0.0-rc4]: https://github.com/evolution-foundation/evo-crm-community/compare/v1.0.0-rc3...v1.0.0-rc4
[v1.0.0-rc3]: https://github.com/evolution-foundation/evo-crm-community/compare/v1.0.0-rc2...v1.0.0-rc3
[v1.0.0-rc2]: https://github.com/evolution-foundation/evo-crm-community/compare/v1.0.0-rc1...v1.0.0-rc2
[v1.0.0-rc1]: https://github.com/evolution-foundation/evo-crm-community/releases/tag/v1.0.0-rc1
