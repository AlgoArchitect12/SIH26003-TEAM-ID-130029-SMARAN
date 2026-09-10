# MVP18B Cognitive Analytics

Takeover audit: 2026-09-10, SMARAN-B only, branch `feature/mvp18b-cognitive-analytics`, baseline/HEAD `d835e03`. The existing uncommitted implementation was inspected and preserved. No commit, merge, tag, APK, dependency addition, configuration change, or new migration was made.

## Takeover findings and corrections

- The repository queries, service, caregiver activity route, seven-language catalogs and regression script were already present. This document was missing.
- The summary reused “Latest recommended level” and “latest completed activity” copy. A window's latest session need not represent the patient's current recommendation. Summary and history now both use the existing translated “Next activity level saved with this session” wording and show the source completion date.
- The period and level-detail buttons did not expose selected/expanded accessibility states. The existing button now forwards native accessibility state while retaining its own actual disabled/busy state. The analytics controls supply selected/expanded state.
- The existing insert-between-pages check inspected only one subsequent page. It now verifies every remaining page against the original 183-row history after both a backdated insert and a tied-timestamp insert. Added checks preserve historical wording, accessibility-state wiring and intentionally unsupported web persistence.
- Temporary infrastructure existed at `.expo/analytics-qa-server.cjs` and `.expo/analytics-qa/`. Inspection confirmed that it copied the app, replaced the copied web database and secure-storage boundaries, and served disposable fixture data through localhost port 8791. Both were removed, along with the prior `.playwright-mcp/` logs/screenshots and `analytics-history-page.png`. Browser artifacts generated during this audit are also removed after recording results here.
- No new analytics query writes, model reads/training, feedback saves, session copying, demo fallback or cross-game metric averaging were found. Analytics does not call the existing game-save/training path.

## IMPLEMENTED: data source and architecture

`app/caregiver/home.tsx` links to `/caregiver/activity`. The screen calls `loadActiveAnalytics` in `src/services/analytics.service.ts`, which resolves the local active profile and calls two read methods in `cognitive.repository.ts`.

The source is the existing native SQLite `cognitive_sessions` table. Only the requested patient's rows with `is_demo_seed = 0` and game type `memory_match`, `pattern_recognition` or `routine_recall` qualify. There is no analytics table, cache, copied session storage or analytics migration. Existing migrations 001–006 and the normal database initialization path are unchanged. Tests apply that existing migration chain only to disposable test databases; no physical-device database was opened or mutated by this takeover.

Each summary uses one parameterized SELECT and its SQLite read snapshot for all games and difficulty groups. A CTE expands facts into per-game and per-game/per-level groups inside the query; it does not persist duplicate rows. History is a separate SELECT. Summary and history are not one cross-query transaction: a concurrent completion can appear in one read before the other. Each subsequent page reloads the summary; history retains its original insertion boundary.

## IMPLEMENTED: formulas and denominators

Every formula below is evaluated separately for each game and, for level details, separately for each recorded difficulty within that game. There is no composite score and no average of incompatible games. Historical accuracy is derived from stored counts rather than blindly trusting a stored percentage.

| Displayed fact | Exact calculation and denominator |
| --- | --- |
| Sessions completed | `COUNT(*)` of qualifying saved completions in the window/group. An empty group has explicit empty copy. |
| Correct attempts | `SUM(matches)` for Memory Match; `SUM(correct_selections)` for Pattern Recognition and Routine Recall. |
| Attempts | `SUM(attempts)` in that game/group. |
| Accuracy | `SUM(correct) / SUM(attempts)`, displayed as a percentage with both correct and attempted counts. This is attempt-weighted accuracy, not the arithmetic mean of session percentages. History uses the same ratio for its single session. |
| Average response time | `SUM(avg_response_ms * attempts) / SUM(attempts WHERE avg_response_ms IS NOT NULL)`, in milliseconds. The UI explicitly displays the attempt denominator. History displays the stored session average and its attempt count. This reconstructs weighting from stored session averages; raw individual response durations are not retained in SQLite. |
| Hints | `SUM(hints_used)` with the number of completed sessions shown. History shows the stored hint count across one session. |
| Repeated errors | `SUM(repeated_mistakes)` for Memory Match or `SUM(repeated_errors)` for selection games. This is a count, not a rate. It is a subset of unsuccessful attempts, never added to attempts. |
| Elapsed time per session | `ROUND((julianday(completed_at) - julianday(started_at)) * 86400000)` milliseconds, only when both timestamps parse and completion is at/after start; otherwise NULL. |
| Average elapsed time | `SUM(valid elapsed milliseconds) / COUNT(valid elapsed values) / 1000`, displayed in seconds with the valid-session denominator. Wall-clock elapsed includes pauses/background time and is not active play time. |
| Participation days | Number of distinct local calendar bins containing at least one qualifying completion, displayed out of 7 or 30 days. Multiple same-day sessions count once per game/group. |
| Difficulty used | Stored difficulty, 1–5. Summary uses the latest completion in its game/window, with ties ordered by session ID; level groups use their stored difficulty. |
| Recorded recommendation | `recommended_difficulty` from that same completed session. It is neither recomputed nor guaranteed to be the current recommendation. |
| Recorded feedback | The session's stored easy/comfortable/challenging label, or “Not recorded” for NULL. No feedback is inferred or saved by analytics. |

The UI formats numbers and dates using the selected language; numeric/percentage displays round to at most one fractional digit. Rounding affects presentation only.

The existing schema requires attempts, valid game-specific correct/repeated counts, hints, response average and difficulty fields. Analytics does not fabricate missing historical fields. NULL feedback and invalid/reversed elapsed timestamps remain unknown. Empty groups are distinct from failed reads. Ratios with missing or nonpositive denominators return NULL; formatting shows translated “Not recorded”, never a substituted zero.

### Per-game meaning

- **Memory Match:** one attempt is one completed two-card comparison; a correct attempt is a matched pair. A repeated mistake means repeating an incorrect symbol-pair comparison within that session. Response timing follows the existing comparison boundaries.
- **Pattern Recognition:** one attempt is one selected answer; a correct answer completes a pattern challenge. A repeated error is another selection of the same incorrect option for the same challenge.
- **Routine Recall:** one attempt is one selected answer; a correct answer completes the next routine step. A repeated error is another selection of the same incorrect option for that step.

Selection games exclude Continue waiting time from response timing. Resume resets the decision boundary in all three games, so recorded response timing cannot be used to reconstruct active play time or all pause durations. No elapsed-time comparison or clinical interpretation is inferred.

## IMPLEMENTED: windows and pagination

The UI offers 7 and 30 local calendar days including today; the tested helper also supports a one-day window. For N days, start is local midnight N−1 dates before today and end is tomorrow's local midnight. Start is inclusive and end exclusive. These are calendar windows, not rolling 168/720-hour durations.

`analyticsWindow` constructs each boundary with local JavaScript calendar components, then serializes it to UTC ISO text. The SQL receives every daily boundary, avoiding SQLite/host timezone disagreement. A New York spring-transition day spans 23 hours and a fall-transition day 25 hours. Exact midnight and adjacent milliseconds are covered by regression tests. The normal game-save path stores canonical UTC ISO timestamps, which the indexed text comparisons and pagination ordering rely on.

The UI displays date range, device timezone and summary-read timestamp. Reads refresh on focus, foreground return, profile/period change, retry and page navigation. There is no midnight timer: a continuously visible screen remains the explicitly timestamped snapshot until another read. A fresh read uses the current device date/timezone. Device clock errors are not corrected by analytics.

History covers all saved dates independently of the selected summary window. Pages replace the displayed set instead of accumulating the full history in UI memory. Default page size is 20, accepted sizes are 1–50, and SQL fetches one extra row to detect another page. There is no 50-row total-history limit.

Ordering is `completed_at DESC, id DESC`. The continuation condition is `completed_at < cursor.completedAt OR (completed_at = cursor.completedAt AND id < cursor.id)`. The cursor also carries patient ID and the initial maximum qualifying SQLite rowid (`ceiling`). Every page enforces the same patient and `rowid <= ceiling`, excluding later inserts even when their completion timestamp ties or predates existing rows. “Newest activities” restarts the traversal and includes new completions.

This is an in-process traversal over append-only saved sessions, not a durable snapshot across table rebuilds, rowid reassignment, external edits or deletion/reinsertion. There is no such operation in the analytics flow. Invalid page sizes, malformed cursor values and cross-patient cursors are rejected. SQL IDs, dates and cursor values are bound parameters.

## IMPLEMENTED: patient isolation and offline behavior

The screen accepts no patient ID from URL/search parameters. `resolveActivePatient` reads the existing SecureStore profile selection and validates the local profile/settings. `loadActiveAnalytics` resolves again after asynchronous reads and rejects a changed/missing active patient. A cursor belonging to another patient is rejected before use. The screen invalidates old requests and hides prior data when focus, foreground or the selected-profile store changes; profile changes clear an incompatible cursor through recovery.

This is the existing shared-device caregiver view, not a remote authenticated caregiver account or permission grant. Direct repository/service helpers take an explicitly supplied patient ID for internal use/tests; they are not authorization endpoints. All new SQL queries, including the rowid ceiling subquery, contain the patient predicate and demo exclusion. Existing recent-session queries also use patient predicates.

No network request is part of the analytics load. Native SQLite remains the offline source of truth. `src/db/client.web.ts` intentionally rejects persistence with “Local SQLite persistence requires a supported native platform.” There is no browser database adapter, localStorage replacement, HTTP database bridge or Playwright production hook. No chart dependency was added.

## UI and accessibility review

- Existing themed text/cards support light/dark appearance and high contrast; stored text-size preferences are applied. Body text wraps, with no truncating line limits. Content is centered with a 680 px maximum width for tablets.
- Existing buttons have a 56 px minimum touch target, wrapping labels, explicit button labels and keyboard focus styling. Period selection and level disclosure now expose selected/expanded states.
- Initial and older-page requests show the shared loading indicator. There are separate empty-window, empty-history, missing-profile and recoverable-error states. A failed page can be retried from the newest history without inventing results. End-of-history and page date/count copy are explicit.
- Headings have header semantics, failures use alerts, and loading/page announcements use polite live regions. Existing read-aloud controls cover the per-game summary and individual history cards, respect voice-guidance settings, and cancel speech on text/focus changes.
- English, Hindi, Assamese, Bengali, Meitei, Khasi and Mizo catalogs are wired into the actual translation catalogs. Key/interpolation parity and absence of English fallback placeholders pass. The six non-English catalogs remain provisional pending native-speaker review; automated scans cannot validate medical wording in every language. Offline voice availability is device-dependent.

## NOT MEASURED / NOT INFERRED

- Abandoned, interrupted, unsaved or pre-storage sessions; earlier app usage; reasons for missing activity.
- Active play time, individual historical response-duration samples, exact pause durations or any other unavailable historical metric.
- Dementia score, cognitive-health score, diagnosis, severity, stage, decline, progression, prediction, treatment effect or clinical risk.
- Real-world functioning, treatment adherence or medical benefit. Lower accuracy is not described as decline, and higher accuracy is not described as dementia improvement.
- Current model weights or a newly calculated recommendation. Analytics never trains, changes adaptation weights, or manufactures feedback.

The existing nonmedical disclaimer remains visible. Facts are presented with game names, stored difficulty, completion timestamps and explicit denominators; there are no diagnostic charts, alerts or labels.

## Validation and evidence limits

The takeover reran the following commands against the actual worktree. They passed; no dependency installation/fix or migration edit was required.

| Command | Result |
| --- | --- |
| `node scripts/check-analytics.cjs` | PASS: device-local, Asia/Kolkata, UTC, America/New_York; real in-memory SQLite and actual repository/service; all three games, weighted metrics, per-level metrics, 1/7/30 days, midnight, 23/25-hour DST boundaries, 183 tied rows, full pagination with intervening inserts, overlapping patients, cross-patient cursors, active/in-flight switch, empty/missing, failure/retry, unknown timing/feedback, demo exclusion. |
| `node scripts/check-cognitive-expansion.cjs` | PASS |
| `node scripts/check-my-care.cjs` | PASS, including its local/India/UTC/New York cases |
| `node scripts/check-native-hardening.cjs` | PASS host checks; its physical-device checks remain explicitly unrun |
| `node scripts/check-product-hardening.cjs` | PASS |
| `node scripts/check-product-polish.cjs` | PASS |
| `node scripts/check-ux-overhaul.cjs` | PASS |
| `node scripts/check-my-day.cjs` | PASS |
| `node scripts/check-my-memories.cjs` | PASS |
| `node scripts/check-my-home.cjs` | PASS |
| `node scripts/check-elderly-ux.cjs` | PASS |
| `npx.cmd tsc --noEmit` | PASS |
| `npx.cmd expo lint` | PASS |
| `npx.cmd expo-doctor` | PASS, 18/18 |
| `npx.cmd expo install --check` | PASS, dependencies up to date |
| `git diff --check` | PASS |

Read-only regression uses SQLite `PRAGMA query_only = ON` and before/after snapshots of sessions, adaptive models, profiles, settings and migration records. Regression fixtures are isolated test data, never production/demo analytics.

Protected diffs are blank: `package.json`, `package-lock.json`, `src/db/migrations`, `src/db/client.web.ts`, `app.json`, `eas.json`. Final status/stat/name-status and untracked-file inventory were inspected. No Android/iOS/web export was rerun in this takeover; previous export claims are not counted as new evidence.

Actual browser QA opened `http://localhost:8085/caregiver/activity` from SMARAN-B with the original web client, without boundary substitutions. At 390×844 and 820×1180 it showed the expected bootstrap storage-recovery state. Retry returned to that same honest error; the 56 px button accepted keyboard focus; neither width overflowed horizontally. Page, bundle and splash requests returned HTTP 200. Console diagnostics were the expected unsupported-native-SQLite error (including retry attempts) and the existing web-notifications warning.

The previous session's disposable-bridge screenshots/logs were inspected before removal. They do not independently prove populated UI behavior for this final source. The native analytics loading/success/empty/pagination/error flows, seven-language layout, extra-large text and theme combinations are source/regression reviewed here, not newly browser-verified. No authentication or storage boundary was bypassed to claim otherwise.

## Physical-device tests still required

1. On supported native Android (and iOS if targeted), complete and save each game at multiple difficulties, then verify exact summary/history facts against those saved sessions after force-stop/relaunch and in airplane mode.
2. Use two actual local profiles with overlapping completion times plus an empty profile. Switch while loading, while on an older page, and after background/foreground transitions; confirm old patient cards and speech never appear for the new profile.
3. Exercise 7/30-day changes, all pages of >50 sessions with tied times, end-of-history, fresh-history restart, and a new completion between pages. Measure large-history query responsiveness on the lowest supported device; the summary still scans the qualifying window.
4. Check local midnight, a timezone change and DST transitions. Confirm the displayed read timestamp/range describes a still-open snapshot and that a subsequent refresh adopts the new calendar boundary.
5. Test TalkBack/VoiceOver reading order, selected/expanded announcements, live loading/errors/page updates and focus after page replacement. Verify offline read-aloud, unavailable voices, cancellation on navigation/profile changes and seven-language pronunciation with native speakers.
6. Check smallest supported phone and tablet, extra-large/system text scaling, light/dark/high-contrast themes, long patient names, all translated labels and difficulty disclosures for clipping/overlap and comfortable touch spacing.
7. Inject a recoverable native database read failure in a disposable device test environment; verify error, retry and absence of fabricated zero analytics. Verify database reopen and read-only behavior on native SQLite.

Versioned reference read before edits: [Expo SDK 54 documentation](https://docs.expo.dev/versions/v54.0.0/). Accessibility-state support was also checked against the installed React Native 0.81.5 type definitions and the existing shared button implementation.
