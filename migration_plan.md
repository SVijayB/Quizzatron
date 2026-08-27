# Quizzatron Revamp — Migration Plan

Living document. Tracks everything that needs doing and everything done for the
`revamp` branch: LLM layer moved to **pydantic-ai + LiteLLM**, backend hardened,
frontend rebuilt from scratch with a deliberate visual identity and real mobile
support.

**Branch:** `revamp` (created from `main` @ `2b35edc`)
**Started:** 2026-08-27

---

## Status legend

| Mark | Meaning |
|------|---------|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Done |
| `[!]` | Blocked / needs a decision |
| `[-]` | Deliberately dropped (with reason) |

---

## 0. Goals & non-goals

**Goals**

1. Replace the hand-rolled Gemini/Ollama calling code with **pydantic-ai** for
   typed, schema-validated output and **LiteLLM** for multi-provider routing.
2. Delete the JSON-repair / fence-stripping / blind-retry apparatus that exists
   only because structured output was never used.
3. Make multiplayer actually correct: server-authoritative scoring and timing,
   survives disconnects, real results endpoint.
4. Rebuild the frontend with a distinctive identity (**retro arcade game-show**),
   genuine mobile support, and real animation craft.
5. Fix the security holes found in the audits (path traversal, arbitrary file
   read, unbounded upload, XSS sink, wide-open CORS).
6. Keep it verifiable: tests that run without API keys or MongoDB.

**Non-goals**

- No auth/accounts. Lobby codes stay the only access control.
- No horizontal scaling. Single-process, in-memory lobbies (documented as such).
- No Discord bot / CLI revival — `scripts/` stays as-is unless it breaks.

---

## 1. Environment constraints (discovered)

| Fact | Consequence |
|------|-------------|
| No `.env`, no `GOOGLE_API_KEY` | Cannot do live LLM verification locally. Need a fake/offline provider for dev + tests. |
| No MongoDB, no Docker, no `mongod` | Mongo-backed categories/questions must degrade gracefully, not 500. |
| Python 3.12.13 (uv venv); CI pins 3.10/3.11 | Bump CI to 3.11–3.13. |
| Node 20.20.2, npm 10.8.2 | Fine. No bun despite `bun.lockb` in repo. |
| Flask-SocketIO has **no** `async_mode`, no eventlet/gevent installed | Runs in **threading** mode, no monkey-patching → `agent.run_sync()` is safe. **Migration is not blocked.** |

- [x] Confirm Socket.IO async mode is `threading` (verified: `api/socket_server.py:15`, no eventlet/gevent)
- [x] Create Python 3.12 venv, install baseline deps
- [x] Install frontend deps, confirm baseline build is green (693 KB single chunk)
- [x] Add `.env.example` entries for every var actually read (incl. the previously-missing `SECRET_KEY`)
- [x] Provide an offline model provider so the app boots and tests run with zero keys

---

## 2. Phase 1 — Backend foundation

- [x] Delete the dead root `app.py` (second competing `create_app`, registered no blueprints)
- [x] Central `api/core/config.py`: absolute paths from `Path(__file__)`, replacing the three CWD-relative paths
- [x] Remove import-time side effects (no `os.makedirs` at import; no provider client at import)
- [x] Lazy, guarded provider construction — a missing key can no longer break app boot
- [x] `MAX_CONTENT_LENGTH` on uploads (10 MB default) + PDF magic-byte check
- [x] CORS tightened to an explicit origin allowlist; dropped the `"*"` + credentials combo
- [x] `SECRET_KEY` required outside local; ephemeral per-process in dev
- [x] Rotating log handler at an absolute path (`logs/quizzatron.log`, 2 MB × 3)
- [x] One pooled `MongoClient` with `serverSelectionTimeoutMS`; returns `None` instead of raising
- [x] `get_categories()` cached with a 10-minute TTL
- [x] `api/core/aio.py`: one long-lived background event loop, so async pydantic-ai works from sync Flask and the HTTP connection pool is reused
- [x] Consistent `{"error": {message, code, retryable}}` envelope; 404s are JSON

## 3. Phase 2 — LLM layer (pydantic-ai + LiteLLM)

- [x] Pinned `pydantic-ai-slim[google,mistral,openai,retries]` 2.35.1
- [x] `GeneratedQuiz` as the agent's `output_type` — the schema enforces the contract
- [x] Prompt rewritten as real instructions; the stale Python fragment is gone
- [x] All JSON-formatting instructions dropped from the prompt
- [x] Prompt self-contradictions fixed (google/bing, the image-ratio conflict, the `True`/`"false"` mismatch)
- [x] Data-driven model registry with per-model key requirements
- [x] Model IDs overridable via `QUIZZATRON_MODEL_<KEY>` — no code edit when a catalogue changes
- [x] Explicit timeout, temperature and `max_tokens`; plus a whole-run ceiling, since pydantic-ai has no built-in run timeout
- [x] Output retries re-prompt with the actual validation error attached
- [x] `api/utils/validate_output.py` deleted (113 lines)
- [x] `num_questions` capped at 30
- [x] `/quiz/models` advertises only models whose key is present
- [x] Offline `FunctionModel` provider so the app and tests run with zero credentials
- [x] Provider errors mapped to actionable messages (auth / rate limit / unavailable / unknown model)
- [-] `response_format` gating — not applicable. pydantic-ai selects the output mode per model profile, so we never send a raw `response_format`.

## 4. Phase 3 — Content sources

- [x] PDF: page cap (60), char cap (24k), single `extract_text()` per page, encrypted/corrupt handled
- [x] PDFs are never written to disk — no upload directory to leak
- [x] **Removed the `?pdf=` arbitrary-local-file-read** (the GET route is gone entirely)
- [x] **Path traversal eliminated** by not downloading images at all
- [x] Images: Wikimedia instead of scraping — properly licensed, no `000001*` race, no temp folder
- [x] Images: concurrent resolution with timeouts and an LRU cache
- [x] Images: query normalisation (drops medium words, keeps real subjects like "map")
- [x] Temp-image folder concern retired — nothing is written, so nothing leaks
- [x] `"False"` string for "no image" replaced with a real `null`
- [x] OpenTDB `response_code` checked, with a distinct message per code; 429 reported as rate limiting
- [x] OpenTDB `None`/malformed results skipped instead of raising `TypeError`
- [x] Mongo `correct_answer` resolved by matching text; **unmatched questions are skipped, not defaulted to `"D"`**
- [x] Fixed `except (..., MongoClient.ServerSelectionTimeoutError)` — that attribute never existed
- [x] Categories endpoint degrades to `[]` instead of 500ing

## 5. Phase 4 — Multiplayer rewrite

- [x] Deleted all three dead implementations (`multiplayer_api.py` handlers, the duplicate broadcast helpers, `multiplayerService.ts`)
- [x] Server owns the countdown via a per-round background task; client timer is display-only
- [x] **Grading and scoring are server-side.** `submit_answer` has no `score` or `is_correct` parameter
- [x] Idempotent answers keyed by question index; out-of-range and pre-start submissions rejected
- [x] Questions generated **outside** the lock, with a timeout
- [x] Per-lobby re-entrant locks; the registry lock guards only the dict
- [x] Disconnected players excluded from the round barrier — one dropped tab no longer deadlocks the game
- [x] Host migration on departure
- [x] `GAME_OVER` state and `final_results` are actually set, so `/results/<code>` works
- [x] `lobby:join` re-emitted on every connect, including from the quiz page
- [x] `GET /game/<code>` includes `settings` and the server clock, so a reload can't desync
- [x] Players keyed by `id`, not name
- [x] Settings are a validated model with ranges; unknown keys ignored; out-of-range is a 400
- [x] Host-only enforcement on settings, start, and restart
- [x] One shape per payload — the duplicated `answers[]`, `player_answered`, `game_over` and `new_question` variants are gone
- [x] Namespaced events with a room on every broadcast; `lobby:closed` emitted; `host_left` deleted
- [x] Lobby reaper started by the app factory and actually runs
- [x] `cleanup_orphaned_players` self-deadlock removed along with the function
- [x] Deterministic tie-breaking: score, then correct count, then total time, then name
- [x] Single start path; `request_next_question` removed entirely
- [x] Answers no longer shipped to clients at game start — `correctIndex` arrives only at reveal

## 6. Phase 5 — API contract v2

- [x] **Fixed `jsonify(questions, 200)`** — responses are objects, and all four workaround sites are gone
- [x] One normalised question shape across LLM / OpenTDB / Mongo: clean options, `correct_index`, separate `image_url`
- [x] Consistent JSON error envelope; JSON 404s
- [x] Real status codes throughout (400 / 403 / 404 / 409 / 413 / 502 / 503)
- [x] Endpoint naming rationalised (`/api/categories`, `/api/quiz/models`, `/api/quiz/category`)

## 7. Phase 6 — Frontend rebuild

**Direction: retro arcade game-show.** Ink black · acid yellow · hot red. Hard
offset shadows, controls that physically drop on press, `Anton` display type.

Design system — **done**:
- [x] Design tokens in `frontend/src/styles/tokens.css` as the single source of colour/shadow/radius/motion
- [x] `index.css` cut from 271 lines to 76 (removed the duplicate `:root`, four copies of `@layer base`, and two pasted copies of the Vite starter)
- [x] `borderRadius`/`boxShadow` declared at **theme** level, so `shadow-lg`/`rounded-2xl` no longer exist — the no-gradient/no-glow rules are mechanical
- [x] Fonts wired up (Anton / Archivo / Space Mono); contrast verified (bone 16.8:1, bone-dim 7.6:1, acid 16.7:1)
- [x] Primitives rebuilt: Button, Panel, AnswerButton, TimerBar, CodeDisplay, AvatarPicker, plus 15 restyled
- [x] `lib/motion.ts` with `useReducedMotionSafe()` as the single animation entry point
- [x] `services/config.ts` + `.env.example` — replaces the hardcoded Render URL
- [x] Deleted: 4 page CSS files (1,890 lines), `CursorEffect`, `multiplayerService.ts`, 31 unused shadcn primitives, `bun.lockb`
- [x] Removed `lovable-tagger`, the `cdn.gpteng.co` script, and 13 unused npm packages; fixed the "Quizztron" title
- [x] TS `strict`, `noUnusedLocals`, `noUnusedParameters` on; `no-unused-vars` back to error
- [x] Vite dev proxy + manual vendor chunks
- [x] CSS 124 KB → 61 KB raw; largest JS chunk 693 KB → 385 KB

Pages and services — **done**:
- [x] Typed `http.ts` / `quizApi.ts` / `multiplayerApi.ts` / `socket.ts` — **zero `any` in the whole `src` tree**
- [x] `types/api.ts` mirrors every server serialiser; cross-checked live against the running backend (see §11)
- [x] Rewritten `MultiplayerContext` (identity + snapshot + connection status, no listener escape hatch)
- [x] `useCountdown` — integer ms, one interval, derived from `deadlineMs` vs `serverNowMs`
- [x] Shared `features/quiz/` engine: `Quiz.tsx` is now **95 lines** and `MultiplayerQuiz.tsx` **113**, replacing 2,092. One scoreboard instead of five.
- [x] All eight pages rebuilt; `React.lazy` per route, one `ErrorBoundary`, one `<Toaster/>`, skip link + `<main>`
- [x] Mobile-first: **zero `100vh`/`min-h-screen`** (all `dvh`), 14 safe-area usages, ≥44px targets
- [x] 18 `aria-live` regions, `focus-visible` throughout, icon+label rather than colour alone
- [x] `dangerouslySetInnerHTML` gone from all five sites; **zero `console.*`**, zero `alert()`
- [x] Route-level code splitting — landing page fetches ~140 kB gzip; socket.io, framer-motion and confetti stay off it
- [x] Shared lobby links now join (the URL code is authoritative; non-members get an inline join form)
- [x] Deleted `apiService.ts`, `socketService.ts`, `Index.tsx`, `Multiplayer.tsx`, `EmojiAvatar.tsx`, `use-mobile.tsx`

## 8. Phase 7 — Tests, CI, docs

- [x] **247 tests, all passing with no API keys and no MongoDB**, 81% coverage
- [x] Multiplayer coverage from zero → engine 81%, socket transport 81%, models 93%, store 87%
- [x] `.coveragerc` deleted; coverage config moved into `pyproject.toml` with nothing omitted
- [x] Server-authoritative scoring tests: grading, tie-break, idempotency, disconnect advance, host migration, anti-cheat
- [x] Contract tests for the normalised question shape across all three sources
- [x] `pylint --fail-under=10` → **10.00/10**; black and isort clean
- [x] `.pylintrc` committed (the PR had gitignored it, which would have hidden the gap from CI)
- [x] CI: Python 3.11/3.12/3.13 on Linux + Windows, installing from `pyproject.toml`; frontend typecheck/lint/build job
- [x] `requirements.txt` **generated** from `pyproject.toml`, so the two manifests cannot drift (this is exactly what broke CI in PR #39)
- [x] Removed `setup.py` — it was a 339-line launcher that setuptools *executed*, making `pip install -e .` fail
- [x] `scripts/cli.py` rewritten against the new service; the divergent duplicate generator and the never-runnable `launcher.py` deleted
- [x] README rewritten: architecture, env vars, run commands, endpoints, structure
- [x] `.env.example` documents every variable actually read, including the previously-undocumented `SECRET_KEY`
- [x] Real-server smoke test: health, generation, multiplayer create, and a Socket.IO handshake over HTTP
- [x] Contract cross-check: every live payload matches the frontend's declared types exactly (no missing or extra keys)
- [x] Both servers run together; API, quiz generation, multiplayer and Socket.IO all verified through the Vite dev proxy
- [ ] Frontend test setup (deferred — no runner configured; see §11)

### Bugs found *during* verification, after both workers reported done

1. **`game:started` reported `started: false` and `state: "lobby"`.** `as_lobby_dict()`
   derived `started` from `state`, which only flips to `QUESTION` when the first
   round opens — so the event announcing the game start said it hadn't. The
   frontend had patched around it client-side. Fixed properly with an explicit
   `Lobby.started` flag, so the payload is truthful and the workaround is moot.
2. **`Answer.questionIndex` is 0-based while `Question.index` is 1-based.** A
   silent off-by-one trap for anything joining answers to questions. The results
   payload now sends both `index` (display ordinal) and `questionIndex` (the
   protocol key), so no consumer needs arithmetic.
3. **The Vite dev proxy was pointed at `http://localhost:5000` and silently
   returned nothing for every request.** Node 17+ resolves `localhost` to `::1`
   first, but the Flask dev server binds IPv4 `127.0.0.1` only, so the proxy got
   ECONNREFUSED. Changed to `127.0.0.1` and made it overridable via
   `VITE_DEV_BACKEND`. This one would have cost someone an afternoon.
4. Three apparent quality-bar violations (`dangerouslySetInnerHTML`, `alert(`,
   a hardcoded Render URL) turned out to be comments documenting v1's behaviour
   plus the legitimate production default in `config.ts`. No action needed —
   recorded so the greps aren't re-litigated later.

## 9. Audit findings (rationale)

Full audits were run against `main` before any changes. Condensed here so the
plan above has traceable justification.

### 9.1 Backend — quiz generation

**Security**
- `GET /api/quiz/generate?pdf=` takes a server filesystem path from the query string and `open()`s it — arbitrary local file read, gated only by `.endswith(".pdf")`.
- `extract_img.py` builds a filename from the **LLM-supplied** image description with `query.replace(" ", "_")`, then `os.remove()` + `os.rename()` on the joined path → path traversal to arbitrary delete/write, reachable via prompt injection through the topic/PDF text.
- No `MAX_CONTENT_LENGTH` on a route accepting arbitrary PDF uploads.
- CORS `origins:"*"` + `supports_credentials:True` + `allow_headers:"*"` — an invalid and insecure combination.
- `SECRET_KEY` defaults to `None` and isn't in `.env.example`.
- `Quiz.tsx:747` renders LLM/OpenTDB text through `dangerouslySetInnerHTML`.

**Correctness**
- `jsonify(questions, 200)` builds a 2-element array `[questions, 200]`; the status is *not* set. Four separate consumers work around it.
- `genai.Client(api_key=GOOGLE_API_KEY)` runs at **import time** — a missing key breaks app boot entirely.
- Case-sensitivity split: the service validates `model.lower()`, the util compares `model == "gemini"` exactly → `model=Gemini` passes validation, then falls through to `return None` → `AttributeError` → swallowed → 3 retries → misleading 500.
- `validate_output.py` returns the cleaned *string*, so its `image: "false" → False` normalization is dead code — `parse_questions` re-parses the raw string.
- `validate_output.py:26` calls `.replace()` unconditionally, but callers can pass a dict or `None` → `AttributeError` → swallowed → the real PDF error never reaches the client.
- `parse_questions` returns the **raw model string** on `JSONDecodeError`, which then gets jsonified as a successful quiz.
- Mongo's `correct_answer` derivation is a nested ternary that **defaults to `"D"`** when nothing matches; hard-indexes `options[0..3]`.
- OpenTDB's `response_code` is never checked → silent empty quizzes; and `format_question_api_output(None)` raises `TypeError` on fetch failure.
- `except (requests.RequestException, MongoClient.ServerSelectionTimeoutError)` — that attribute doesn't exist on `MongoClient`, so the except clause itself raises.
- `api/app.py` and root `app.py` both define `create_app`; the root one registers no blueprints.

**Performance / resources**
- `get_categories()` does a fresh OpenTDB HTTP round trip *plus* a fresh Mongo connect on every call, with no caching — and it's called on every quiz-by-category request too.
- `MongoClient` constructed per request, never closed, no `serverSelectionTimeoutMS` (30 s default).
- Image downloads are fully serial with no timeout; N image questions = N sequential crawls inside the request.
- `cleanup_temp_folder()` has zero production callers → `api/static/temp` grows forever.
- Uploaded PDFs are never deleted.
- PDF text extraction calls `page.extract_text()` twice per page; no page/char cap at all.
- No timeout, backoff, or cancellation on any LLM call.
- Three CWD-relative paths break any process not started from the repo root.

### 9.2 Multiplayer

**Two complete dead implementations on each side** (`multiplayer_api.py:35-190`, `socket_server.py:313-386`, all of `multiplayerService.ts`) referencing state fields that don't exist and events nobody listens to.

**Critical**
- Scoring and grading are **client-authoritative**; the server does `player["score"] += score` with whatever the client sent.
- No duplicate/index/state guard on the socket answer path — replaying `submit_answer` multiplies your score. Submitting *before* start makes `questions_count = 0`, so the server immediately broadcasts `game_over`.
- **No server timers exist at all.** The client owns the countdown and the host client alone triggers question advance.
- `handle_disconnect` removes nobody, and `all_answers_in` requires every player to have answered → one closed tab deadlocks the game forever.
- Host dropping mid-game freezes the game permanently (only the host emits `request_next_question`; no migration).
- The game never sets `GAME_OVER` or `final_results`, so `GET /results/:code` **always** returns 400. Results only work because the client caches them in localStorage.
- Reconnect never rejoins the room (`socketService.ts:239-242` logs instead of emitting `join_room`) → silently receives nothing afterwards.
- `cleanup_inactive_lobbies` is never called → `active_lobbies` grows for the process lifetime.
- The global `lobbies_lock` is held across the entire LLM generation + image crawls, freezing all lobbies.
- `cleanup_orphaned_players` takes a non-reentrant lock twice — guaranteed deadlock if ever enabled.

**High**
- `game_started` is emitted without `room=`, so only the host receives it; others navigate off `new_question`.
- `lobby_closed` has no client listener; `host_left` has no server emitter.
- Duplicated payload shapes: `answers[]` ×2 (breaking answer review), `player_answered` ×2, `game_over` ×2, `new_question` index field ×2.
- `GET /game/:code` omits `settings` → a quiz reload resets `timePerQuestion` to 15 and difficulty to medium, changing that player's timer and score multiplier.
- Double start-game (socket + REST), then unconditional navigation after 500 ms even on failure — hence the "ignore all errors for 5 s" hack downstream.
- Player identity is the **name**, not the uuid; any client can act as another player.
- `settings` accepts arbitrary keys with no validation; `numQuestions` unbounded server-side.
- No auth, rate limiting, or ownership checks on any multiplayer endpoint.
- Ties are never broken; `time_taken` is stored but never used.
- Zero multiplayer tests.

### 9.3 Frontend

Audit accounts for **~4,700 lines of provably dead code** and **1,890 lines of
global CSS that collides with itself** out of 15,265 total. There is no design
system. A rewrite is the correct call.

**There is no working design system**
- `:root` is declared **twice** in `index.css` with conflicting values. The second overrides `--primary` from violet to slate — so the purple "brand" token the whole app appears to use is **dead**.
- `tailwind.config.ts` has **no `fontFamily`** (everything is the browser default), **no `borderRadius`** (so `--radius` is never consumed), no spacing/fontSize/boxShadow scale.
- Its three keyframes (`fade-up`, `fade-down`, `blob`) are **used zero times**, and are defined 4× across two files.
- `accordion.tsx` uses `animate-accordion-*`, which is not defined anywhere.
- The 8 `--sidebar-*` vars have no matching Tailwind colors, so `sidebar.tsx`'s 19 classes emit nothing.
- A full `.dark` block exists but `dark` is never applied to any element, and no `ThemeProvider` is mounted.
- **51 hardcoded hex literals** and 19 raw `rgba()` in TSX, plus **four mutually incompatible page-background implementations** (one page is `bg-gray-100` white in a dark app).

**Things that render nothing at all**
- `bg-grid-white/[0.02]` — used 4× for a "subtle grid texture". No such utility and no CSS. Never worked.
- Gradient text at `Index.tsx:510` and `Multiplayer.tsx:303` sets both `text-white` and `text-transparent`; `text-white` wins, so the gradient never renders. 2 of 4 attempts are no-ops.
- `MultiplayerQuiz.tsx:1190-1193` renders 4 overlay divs whose classes don't exist — which is why that page's background doesn't match any other.
- `pages/Index.css` contains mobile fixes for a class that doesn't exist, in a file nothing imports.

**Mobile (375px)**
- `MultiplayerLobby.css:161` `.players-card { min-width: 350px }` is never reset in the `max-width:1024px` block → **the lobby scrolls horizontally on every phone**.
- The topic input has an absolutely-positioned "Upload PDF" button over it with no reserved padding → typed text runs underneath.
- `grid grid-cols-2` never collapses in the About dialog (~92px of text width) or the settings panel.
- The multiplayer WAITING overlay is `absolute inset-0` on a container taller than the viewport → **users can scroll past it to the live question**.
- 19 `100vh`/`min-h-screen` sites, zero `dvh` → clipped by iOS Safari's URL bar.
- Zero `env(safe-area-inset-*)` anywhere; no `viewport-fit=cover`.
- A 40×20px custom toggle — a **20px tap target** vs the 44px minimum.
- The only explanatory copy for Create/Join lives in Radix `Tooltip`s, which don't open on tap → **unreachable on mobile**.
- `useIsMobile` exists but is only consumed by `sidebar.tsx`, which nothing imports → effectively dead.

**Animation / performance**
- `CursorEffect.tsx` calls `setPosition` **and** `getComputedStyle` on every `mousemove` → a React render plus a forced sync style recalc per pointer event, on 4 pages. On touch it paints a purple dot stuck at (0,0) forever.
- 27 simultaneously animated `backdrop-blur` particles; `Results.tsx` animates 15 elements at `backdrop-blur-3xl` (64px).
- A firework system `setInterval`s **every 1s forever**, animating `box-shadow` spread (a paint property) with unbounded DOM churn.
- The multiplayer timer effect lists `countdown` in its deps → the 100ms interval is torn down and recreated 10×/second.
- `players.sort(...)` mutates React state **during render** at 3 sites, one of which feeds a `layout` animation.
- ~40 infinite animations per page and **zero `prefers-reduced-motion` support** — the only two such blocks are `no-preference` queries targeting a nonexistent class.

**Accessibility**
- 5 `aria-*` attributes total in non-`ui/` code. Zero `role`, `tabIndex`, `onKeyDown`, `aria-live`.
- Answer buttons have **no `focus-visible` styling** over translucent glass — keyboard focus is effectively invisible. `disabled` on reveal strands focus on `<body>` every question.
- **Screen reader users never learn whether they answered correctly** — the feedback overlay has no `role="status"`/`aria-live`.
- Correctness is signaled by color + a `Sparkles` icon with no text label → fails WCAG 1.4.1.
- Multiple contrast failures around 2.0–2.4:1, including 10px text at 2.4:1.
- `focus:ring-0` actively strips a focus ring; the 80px avatar target is a non-focusable `div`.
- `dangerouslySetInnerHTML` on LLM output at **5 sites** (question text *and* every option).
- Two blocking `alert()` calls mid-game.

**Code quality**
- `Quiz.tsx` + `MultiplayerQuiz.tsx` = 2,092 lines sharing **165 identical lines**; the question card is ~88% identical (12-line real diff). The feedback overlay is character-identical.
- The background decoration block is copy-pasted 5×  (~450 lines).
- **Five** live-scoreboard implementations; three inside `MultiplayerQuiz.tsx` alone.
- `MultiplayerQuiz.tsx`: 1,200 lines, 18 `useState` + 3 refs shadowing state, one 155-line effect, one 672-line `renderContent()`.
- localStorage is used as a global event bus (11 unnamespaced keys). Two keys are read but never written; one is written but never read; `playerEmoji` is written but read as `playerAvatar` → avatars always fall back.
- **Provably unreachable:** `Quiz.tsx` reads `multiplayerQuizData`, which nothing writes, making ~120 lines dead; `Results.tsx`'s `isMultiplayer` can never be true, making ~90 more dead.
- `MultiplayerLobby.tsx:103` requires the context lobby code to equal the URL one → **shared lobby links are un-joinable**, defeating the feature the UI advertises.
- 37 explicit `any`; every socket payload is `any`. `strict: false`, `noImplicitAny: false`, `noUnusedLocals: false`, and `no-unused-vars: off` — which is precisely why 4,700 dead lines compile clean.
- 175 `console.*` calls; two lockfiles (`bun.lockb` + `package-lock.json`); 14 removable npm packages; two toast systems mounted at once.
- Lovable residue shipped to production: `cdn.gpteng.co/gptengineer.js` in `index.html`, `lovable-tagger` in the Vite config, `"name": "vite_react_shadcn_ts"`, and a Lovable-boilerplate README. The page title is misspelled "Quizztron".

**Worth keeping**
`QuizLogo.tsx` (the only original visual identity), the curated emoji dataset,
`socketService`'s unsubscribe-closure `on()` pattern, the five domain interfaces
in `apiService.ts`, `cn()`, the scoring *concept* (seconds remaining × difficulty
multiplier), the 2-1-3 podium *layout* idea, and the 20 in-use shadcn primitives
— all verified stock/unmodified, so regenerate them from the CLI rather than
porting.

---

## 10. Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Work on branch `revamp` rather than `revamp/v2` | `revamp` already existed at the same commit as `main`; user chose to reuse it |
| 2 | Visual direction: retro arcade game-show | Chosen from four options; fits "we one-up QuizUp" and is the strongest break from the Lovable look |
| 3 | Rewrite multiplayer rather than patch | Scoring, timing, disconnect handling, and results are all structurally wrong; two dead parallel implementations to remove first |
| 4 | Server-authoritative game loop | Required to fix cheating, deadlocks, and host-drop freezes together |
| 5 | Clean question contract (no `"A) "` prefixes, explicit `correct_index`) | Both sides are being rewritten, so no compatibility burden |
| 6 | Keep in-memory lobbies | No Redis available; single-process is already forced by `allow_unsafe_werkzeug=True`. Documented as a scaling limit. |
| 7 | **Do not vendor the `litellm` SDK.** Use pydantic-ai native providers + `FallbackModel`, with optional LiteLLM *proxy* support via `LiteLLMProvider` + `LITELLM_BASE_URL`. | Verified dependency conflict: litellm 1.98.0 requires `openai<3`, pydantic-ai-slim[openai] requires `openai>=3`. Installing both silently resolves litellm back to 1.83.0. And `LiteLLMProvider` **never imports the litellm SDK** (grepped the 2.35.1 wheel: zero hits) — it is an OpenAI-compatible HTTP client plus per-vendor model profiles. So the proxy gives litellm's gateway benefits with zero dependency conflict, since the proxy is its own service. |
| 8 | Offline provider built on `FunctionModel`, not `TestModel` | `TestModel` was the first choice, but it emits `['a','a','a','a']` for a list-of-strings field, which the "options must be distinct" rule correctly rejects. A `FunctionModel` returns plausible placeholder questions in the requested quantity instead, so the app and the whole suite run against zero credentials. |
| 9 | Images link to Wikimedia instead of being downloaded and re-hosted | Removes an entire class of bug rather than fixing it: the path traversal, the `000001*` race, the unbounded temp-folder leak, and the licensing regression all disappear when nothing is written to disk. Also drops the `icrawler` dependency and is far faster. Trade-off: coverage is narrower than image search, and trademarked logos are absent — the prompt now steers away from those. |
| 10 | Prefix stripping requires a full ordered A/B/C/D enumeration | Stripping per option would corrupt legitimate answers like `"D - Day"`. Requiring all four options to carry sequential letters makes false positives essentially impossible. |
| 11 | Strict `Difficulty.parse` for user input, lenient `Difficulty.coerce` for provider data | `difficulty=spicy` should be a 400, not a silent downgrade to medium; but an unexpected label in an OpenTDB or Mongo record should degrade rather than fail the request. |
| 12 | `requirements.txt` generated from `pyproject.toml` | This is precisely the drift that broke CI in PR #39 (`tenacity` added to one manifest but not the other). Generation makes it structurally impossible. |
| 13 | Deleted `setup.py` | It was a 339-line dev launcher, not a build script — and setuptools *executes* it, so `pip install -e .` shelled out to `pip install -r requirements.txt` and failed. Verified before and after. |

**Verified stack:** `pydantic-ai-slim[google,mistral,openai,retries]` 2.35.1 ·
`openai` 3.5.0 · `google-genai` 2.20.0 · `mistralai` 2.9.4 · `pydantic` 2.13.4.
Confirmed by direct introspection: `output_type` exists and `result_type` does
not; `result.output` returns the validated model; `Agent(..., retries=)`,
`ModelSettings(temperature/timeout/max_tokens)`, `FallbackModel(default_model,
fallback_models, fallback_on)` and `LiteLLMProvider(api_key, api_base)` all
present; instrumentation defaults to off (`Agent._instrument_default is False`),
so logfire is never required.

---

## 11. Verification status — what is actually proven

Being precise about this matters, because the environment has no credentials and
no database.

**Verified by execution**

| Area | Evidence |
|---|---|
| Backend suite | 247 tests pass with no API keys and no MongoDB; 81% coverage |
| Lint gates | `pylint --fail-under=10 api/` → 10.00/10; black and isort clean |
| App boots and serves | Real `python wsgi.py`, then `curl`: `/api/health`, `POST /api/quiz/generate`, `POST /api/multiplayer/create`, and a Socket.IO polling handshake advertising a websocket upgrade. No errors logged. |
| Full multiplayer game | Runs to `GAME_OVER` unattended over both the engine API and Socket.IO test clients: question → reveal → advance → results |
| The v1 headline bugs | Each has a test that would fail against the old behaviour: dropped-player deadlock, host-drop freeze, score replay, answer leak, permanent 400 on `/results`, `"D"`-default answer key, `[[...],200]` response shape |
| OpenTDB integration | Exercised against the **live** API: 24 categories, real questions, correct answer indices, 429 handling |
| Wikimedia images | Exercised **live**: flags, landmarks and people resolve correctly; 6 queries concurrently in 0.67s; misses return `null` |
| `pip install -e .` | Confirmed broken with `setup.py` present, confirmed working after removal |
| Dependency conflict | Confirmed by resolution: litellm 1.98.0 forces `openai` 3.5.0 → 2.54.0 |
| Frontend build | `npm run build` succeeds; CSS 124 KB → 61 KB raw, largest JS chunk 693 KB → 385 KB |

**NOT verified — and cannot be here**

- **No real LLM call has ever been made.** Every generation path ran through the
  offline model. The pydantic-ai wiring is verified structurally (schema
  validation, retry-on-invalid-output, timeout, error mapping) but not against a
  live provider.
- **Provider model IDs are unconfirmed.** `gemini-2.5-flash`, `gemini-2.5-pro`,
  `mistral-large-latest`, `gpt-4.1-mini`, `deepseek-chat` are plausible but were
  not checked against any live catalogue. A wrong ID surfaces as a clear
  "not available from the provider" error, and every one is overridable with
  `QUIZZATRON_MODEL_<KEY>`. **Verify these before deploying.**
- **The LiteLLM proxy path is untested end to end.** `LiteLLMProvider` is
  constructed correctly and gated on `LITELLM_BASE_URL`, but no proxy was run.
- **MongoDB is untested against a real server.** Document conversion is unit
  tested; connection pooling and timeouts are not exercised.
- **No browser testing.** The frontend compiles, lints, builds, and its declared
  types were cross-checked against live backend payloads — but **no page has been
  rendered, clicked, or viewed on a device.** Layout, animation feel, and real
  interaction are unverified. This is the biggest remaining gap.
- **No frontend tests.** No runner is configured.

**Recommended next steps**

1. **Load the app in a browser and play a two-tab multiplayer game.** Everything
   below matters less than this. Run `python wsgi.py` and `npm run dev`, then open
   http://localhost:8080 in two tabs.
2. Add a `GOOGLE_API_KEY` and run one real generation; confirm the model ID
   resolves against the live catalogue.
3. Add frontend tests (Vitest + Testing Library) — currently none exist.
4. Decide whether to reinstate a local-model path. The old Ollama/`deepseek-r1`
   route was dropped: it had no `OLLAMA_HOST`, so it could never work in
   deployment, and its `<think>` blocks were never stripped.
