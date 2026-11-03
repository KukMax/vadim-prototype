# Audit — iteration 2A (cycle model, subscription states, profile edits)

Mode: read-only. No project file was modified, no browser/server used. Verification by reading, Grep and `node --check` only.

## Point-by-point

| point | status | file | note |
|---|---|---|---|
| A1 | DONE | `js/views/profile.js:48–68`, `js/app.js:542–613`, `143–155` | Avatar in profile header, topbar button and sidebar card (`.avatar-img`, `object-fit:cover`, `alt=""`); JPEG 0.85 on 256×256 canvas, non-image/>5 MB rejected with toast, «Удалить фото» only with a photo; re-render + `syncProfileChrome` make it instant. |
| A2 | DONE | `js/state.js:6–44`, `92` | `STATE.profile = {avatar, phone, email}`, key `trenio-profile`, `loadProfile` in `buildState()` at boot, `persistProfile` wrapped in try/catch; theme key untouched. |
| A3 | DONE | `js/views/profile.js:70–82`, `js/app.js:361–425` | Plain `<span class="contact-value">` (no `tel:`/`mailto:`, `color:var(--text)`), «Изменить» link-btn ≥44px, sheet with `type=tel/inputmode=tel/autocomplete=tel` + `type=email`, inline Russian errors, 10–15 digit and e-mail checks, `normalizePhone` → `+7 900 000-00-00`, toast «Контакты сохранены». |
| B | DONE | `js/data.js:324` | Label «Бицепс (напряжён)» + `howTo` text verbatim. |
| C1 | DONE | `js/data.js:122–216` | A «Грудь и спина» 60 мин / 6 main, B «Ноги» 65 / 7, C «Плечи и руки» 55 / 6, D «Ноги и ягодицы» 60 / 6; block order cardio 7 мин → warmup 3 мин → main → cardio 20 мин; free-text sets/weight/tempo/rest with mixed formats; 3 `note`s total. |
| C2 | DONE | `js/data.js:218–265` | `buildCycle` 12 sessions, `(n-1)%4` template order, item ids `${id}-${n}-${blockIndex}-${itemIndex}` (223–229), `videoUrl` on main items only (241), `doneDate` (253), `startedAt/finishedAt` (262–263). |
| C3 | DONE | `js/data.js:267–288` | Current cycle #3, doneCount 4 at today−10/−8/−5/−2; archive cycles 2 and 1 all done from `[2,2,3,2,2,3,1,3,2,2,3]`, endings today−16 and today−66. |
| C4 | DONE | `js/data.js:290–293` | `subscription` object exactly as specified. |
| C5 | DONE | `js/data.js:295–304` | 5 training recs + `note` «Персональный план составляет Вадим после активации пакета.». |
| C6 | DONE | `js/data.js:306–313` | 4 `tableLegend` items with the exact texts + `restHint` «Между тренировками отдыхайте 1–2 дня.». |
| D | PARTIAL | `js/state.js:61–92`, `137–243`, `js/app.js:93–112`, `114–124` | Shape, seeding, all selectors (`nextSession`, `doneCount`, `lastDoneDate`, `daysSince`, `agoText`), completed-cycle rule and archive-first all present. Gap: `go()` returns at `js/app.js:116–121` when the route is unchanged, so re-clicking the «Тренировки» nav item while on that screen does **not** reset `tab`/`selected` (only a real hash change runs `prepareWorkouts`). |
| E1 | DONE | `js/views/workouts.js:54–75`, `310–318` | «Тренировки» + «Цикл №3 · 4 из 12 тренировок», segmented control for active/completed, none renders `noneView` without it. |
| E2 | DONE | `js/ui.js:52–130`, `js/views/workouts.js:79–184`, `css/workouts.css:13–14`, `149–152`, `154–172` | Strip 6/row <768px, 12/row ≥768px, 52px targets, done/next/upcoming/selected states + `aria-label` «Тренировка 5, следующая»; session card (eyebrow, chips, badge, block progress fill, «Последняя тренировка: 2 дня назад» only on next, restHint, undo); legend button → sheet; cardio/warmup rows and main table rows with note, round 44px video link (`i-play` in sprite, `index.html:113`), 44px check; ticking updates progress in place; sticky dock with the two toasts and «Завершить тренировку»/«Отметить невыполненной». Layout nuance in Minor. |
| E3 | PARTIAL | `js/views/workouts.js:188–254` | Archive list + read-only detail (no check buttons — static spans, no dock), «К архиву» with chevron rotated 180° at `css/workouts.css:100–103`, completed current cycle listed first. Gap: card reads «Цикл 2 · 12 тренировок · 3 окт – 7 ноя» - the «из 12» part of «12 из 12 тренировок» is missing (`workouts.js:201`). |
| E4 | DONE | `js/views/workouts.js:276–295`, `js/app.js:335–383`, `723–730` | Banner, «Связаться с Вадимом» → contact sheet, `generalRecs` accordion (first open, `aria-expanded`) + note. |
| E5 | DONE | `js/views/workouts.js:297–306` | Banner for not activated, no tabs/archive. |
| F | DONE | `js/views/home.js:93–145`, `js/app.js:172–183`, `index.html:16–27` | Hero switches on status, subtitle «Цикл №3 · 4 из 12 тренировок» / «Цикл завершён — отличная работа! …» / «Персональные тренировки не подключены…», 12-button strip → `#/workouts` with `pendingWorkoutSelection`, primary button opens the next session, tile numbers from `doneCount`; theme applied by the head script before first paint. |
| G | DONE | `js/views/profile.js:84–155`, `js/app.js:731–747` | Both package rows with status chips and progress, training detail «4 из 12 тренировок · цикл №3», nutrition «до 24 ноя · осталось 21 дн.» computed from data, `data-demo="true"` card, 3-way segmented control, reset clears `trenio-profile` and reloads. |
| H | MISSING | `PROJECT_NOTES.md` | File untouched by 2A. Still `weekStrip` (40), data key `schedule` (153), `supplementsInfo` (155), `#/supplements` redirect (124, 220), `toggle-supplements` (93), theme-only persistence (81, 133) with no `trenio-profile`, no `css/workouts.css`/`css/profile.css` in the file map, no `buildCycle`/cycle model/subscription states/demo panel, and the checklist/roadmap (218–255) still say «Ничего из перечисленного сейчас не реализовано» and promise the old 4-week plan. |

## Other checks (steps 1, 3, 5)

| check | status | file | note |
|---|---|---|---|
| `node --check` | PASS | all 10 files in `js/` + `js/views/` | `data.js`, `util.js`, `state.js`, `ui.js`, `app.js`, `views/{home,workouts,nutrition,reports,profile}.js` — no syntax errors (runtime failure is separate, see Blocking). |
| `index.html` links | PASS | `index.html:10–15`, `204–213` | `tokens`, `base`, `layout`, `screens`, `workouts`, `profile` in that order; scripts deferred in data → util → state → ui → views → app order; no reference to a missing file, no `#/supplements` nav item. |
| old-model leftovers | PASS | `js/` | No `DATA.schedule`, `weekStrip`, `workoutDay`, `select-workout-day` or `open-workout`; no `App.*` member called but never defined; the only leftovers are the nutrition-related ones listed in Minor. |
| `.gitignore` | FAIL | project root | File does not exist at all (rule 13 asks for `_*`, `*.pdf`, `.DS_Store`). |

## Blocking problems

1. **The app does not start — `toMinutes` is undefined in `js/state.js`.** `buildState()` calls `toMinutes(meal.time)` at `js/state.js:62`, but the `App.util` destructure at `js/state.js:5` does not include `toMinutes` (its only definition is `js/util.js:36`, exported at `138`). `const STATE = buildState()` at `js/state.js:92` therefore throws `ReferenceError: toMinutes is not defined` at parse/execute time, `window.App.state` is never set, `js/app.js:6` assigns `undefined` to `STATE`, and the boot `render()` at `js/app.js:891` throws on the first view. Result: blank page, every route unreachable. One-line fix: add `toMinutes` to the line 5 destructure (or call `App.util.toMinutes`).

No other blocking problem was found; all remaining issues are cosmetic or documentation-level.

## Minor

1. **`PROJECT_NOTES.md` not updated (point H)** — see the table row: stale routes, removed data keys, missing new files/data keys, no cycle model, roadmap contradicts the shipped 2A. This is the same problem as the failing step 5 for docs.
2. **No `.gitignore`** at the project root (`_*`, `*.pdf`, `.DS_Store` missing).
3. **D: same-route nav re-click does not reset the workouts tab** (`js/app.js:116–121`) — clicking «Тренировки» while already there keeps `tab:"archive"` / the previously selected session; only a hash change or the segmented control resets it.
4. **E3: archive card wording** (`js/views/workouts.js:201`) — «12 тренировок» instead of «12 из 12 тренировок». Also `cycleCard` uses today as the end date for the completed current cycle (`js/views/workouts.js:195`) instead of the last done date.
5. **E2: mobile value layout deviates from the spec text** — below 768px the four value cells always flow into a 2×2 grid (`css/workouts.css:158`), while the spec asks for a stacked 4-cell list with 2×2 only under 360px (there is no 360px breakpoint); captions use a `.ex-cap` span (`css/workouts.css:72`, `162`) rather than `data-label` + `::before`. Visual result is the same information, tighter.
6. **Old-model leftovers, all nutrition-bound and harmless** — `#/supplements` → `nutrition` redirect (`js/app.js:34–36`), `supplementsOpen` in state (`js/state.js:73`), unused `avatar: null` (`js/state.js:74`), unused date helpers `D/E/S/R/T` (`js/data.js:4–8`), `.supplements-*` rules still in `css/screens.css:188–189` (reachable from the Nutrition screen, so not dead).
