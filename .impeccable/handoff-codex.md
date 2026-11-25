# anguy.app redesign: external review handoff

For: Codex (Sol Max), external reviewer working in parallel with Claude Code.
Written: 2026-11-24. Repo: `c:\dev\anguy22.github.io-main\anguy22.github.io-main` (public, GitHub Pages, custom domain anguy.app).

---

## 1. Your role and the working protocol

- **You review; Claude builds.** Claude Code owns every source file and is editing them live. Do not edit `index.html`, `css/`, `js/`, `img/`, `PRODUCT.md`, or anything under `.impeccable/` except your findings file. Two agents writing the same files will clobber each other.
- **Never delete, move, or `git clean` anything.** On 2026-11-24 at 18:39, a file disappeared from the working tree, and it was not removed by Claude. If you think a file should go, say so in findings.
- **Write findings to `.impeccable/review/codex-findings.md`** (create it). Claude reads it between build rounds. Append; do not rewrite earlier entries. Mark resolved items `[resolved]` only after re-verifying.
- **Finding format**, one per entry:
  ```
  ### [P1|P2|P3] short title
  file:line  (or section / viewport)
  What is wrong, the concrete evidence (screenshot path, computed value, quote), and the fix you recommend.
  Rule it breaks: (user directive / product truth / craft floor / a11y / perf)
  ```
  P1 = wrong fact, broken function, a11y blocker, or violation of a user directive. P2 = visible craft defect. P3 = polish.
- **Judge against this document, not your own taste.** The user pinned the direction (section 3). A finding that boils down to "I'd prefer a different aesthetic" is out of scope. A finding that the build fails the pinned direction is in scope and valuable.
- If you need to run things: `python -m http.server 8123 --bind 127.0.0.1` from the repo root, then open `http://127.0.0.1:8123/`. Claude may already be serving on 8123; if so, use another port. Do not open `index.html` over `file://`; the scripts are ES modules.

---

## 2. What the site is

Personal site for **Andrew Nguyen**, an Industrial Engineering student (Statistics minor) at Purdue, est. graduation May 2028. Audience, in the user's own ranking: **peers and network first** (people who met him through chess, soccer, Purdue, semis; arriving on a phone from a shared link), recruiters second. Personality leads; the resume must still be findable in seconds.

Stack: static HTML, CSS, and ES-module JS. No build step, no framework, no Node on this machine. Hosted by GitHub Pages (Jekyll runs on push; dot-folders are not published).

The old site (a WebGL 3D "ride" plus `classic.html`, background audio, a Markets sheet, and a pitch-zone map) has been **retired and deleted** from the working tree on the user's instruction. It remains in git history. Do not recommend bringing any of it back.

---

## 3. The user's pinned directives (these win over everything)

In order received:

1. Revamp using the imported skills **impeccable** and **tasteskill (design-taste-frontend)**, keeping existing content but with a new concept and look.
2. Primary audience: **peers and network**. Replace the 3D ride **entirely**. The only must-keep feature: **live Lichess stats**.
3. Reference: **ryanrana.com**. "I want my personal website to look and feel like this." The structure and restraint carry over; the code, copy, and assets do not (see section 5).
4. **Dark green and white**, then refined to: **glossy black metal with dark green accents**, white type. "Classy, modern, clean." Abandon the simulation feel.
5. Replace ryanrana's bookshelf with a **toolbox**: one object per skill, with creative liberty (examples given: a snake for Python, a manual for SQL).
6. Write the name in **Apple-"hello"-style cursive that draws itself across the screen**.
7. User choices from the last decision round: toolbox form = **tool chest with drawers**; hero visual = **chrome bell curve** (Galton board); lettering = **custom monoline script**.
8. **No photo of Andrew anywhere on the site** ("Do NOT use any photo of me inside this website.").

---

## 4. Product truth and content rules

Facts on the page must trace to the user's own prior site content (summarized in `PRODUCT.md`). **Never invent** numbers, employers, dates, testimonials, or claims. Watch especially for:

- **Chess rating trap.** The resume says "2000+ Elo-rated" (league or over-the-board play). Live Lichess rapid is currently **~1898**. The page must never say "2000+ on lichess" or "2000+ rapid on lichess." "2000+ rated" is allowed only when it refers to league play or the CCL. Flag any regression.
- Dates without a source (Solar PV, bridge regression) are **not shown**. Do not add any.
- Contact details allowed: school email `nguy1051@purdue.edu`, LinkedIn, GitHub, Lichess. **No** phone, home address, or personal email (`.gitignore` documents why).
- Voice: **lowercase, warm, dry** in the bio and descriptions ("hi there. i'm andrew.", "if we're going to be replaced by ai it might as well be accurate.", "built with diet coke and ai"). Headings and proper nouns are sentence case. The "diet coke" footer vs the "coke zero" footnote is a deliberate joke from the original site. Keep both.
- **No photographs of Andrew, anywhere on the site.** This is a hard user directive (2026-11-24). The photo crop and the original `IMG_6641.jpg` have been deleted. Any image of him (a photo, avatar, or illustration built from a photo) is a P1 finding.
- Lichess data loads client-side from `https://lichess.org/api/user/an_d22`. Formats with 0 games show "—". When the API fails, the page shows a plain recovery line, never fake numbers.

---

## 5. Creative strategy (the direction contract)

**Thesis.** A quiet black page with one handmade object: a glossy black tool chest whose drawers hold Andrew's skills as objects set in green foam. It refuses both the category's card-grid portfolio and the old site's 3D spectacle.

**Own world.** Near-black ground tinted toward green, white ink, green-gray secondary text. Two materials only: **glossy black enamel** and **polished chrome**, used for the chest, drawer fronts, handles, tools, hero balls, and the name stroke. **Dark green is an accent, never a page fill**: foam liner, live dot, focus ring, the fitted normal curve, active states, footnote numbers.

**Story.** The visitor watches the name write itself, reads a short lowercase bio whose phrases open numbered footnotes inline, scans experience and projects, opens drawers to see what he works with, sees his live chess numbers, and copies his email.

**First viewport (desktop).** Thin sticky nav (name left; Experience, Projects, Toolbox, Chess, Contact right). Left column: the chrome cursive "andrew nguyen" (~540px), the bio, a two-column dash list of footnoted roles, the live Lichess status line, then a chrome "copy email" pill and icon buttons. Right half: canvas Galton board where chrome balls fall through faint pegs into bins, a green normal curve fits the pile, and the readout shows n and the sample's own μ and σ.

**Signature interactions.** (1) The name draws once on load (~4s, two strokes). (2) The Galton board fills, fits, holds, fades, and loops; it pauses off-screen and when the tab is hidden. (3) Drawers slide open one at a time; a tool lifts out of its foam cutout on hover or focus and fills the detail plate on click. (4) The contact section signs "andrew" in the same hand when scrolled into view.

**Relationship to ryanrana.com.** Borrowed: black ground, restrained nav, lowercase bio with inline numbered footnotes, plain experience list, one handmade personality section, project tags. **Not borrowed and must not appear:** his terminal intro, node-mesh canvas, painting thumbnails, "served to you from" line, "for agents" button, bookshelf assets, lamp, copy, or code. Flag anything that reads as lifted.

**Lettering.** `js/script-name.js` holds original hand-authored monoline glyph paths (a, d, e, g, n, r, u, w, y) joined by tangent-continuous connectors, with cusps where cursive retraces a downstroke or enters a bowl. These are **not Apple's paths** and must not be replaced with traced Apple artwork.

---

## 6. Design system as built

| Token | Value | Use |
|---|---|---|
| `--bg` | `#050706` | page ground |
| `--ink` / `--ink-2` / `--muted` | `#eef1ee` / `#c9d0cc` / `#8f9994` | text tiers (muted is about 6.9:1 on bg) |
| `--green-500` | `#34a873` | live dot, curve, focus, active, wins bar |
| `--green-300` | `#7fd1a8` | footnote numerals, plate sub-line, μ/σ readout |
| `--foam` / `--foam-deep` | `#0c2c1f` / `#04150d` | drawer tray, tool cutouts |
| chrome | SVG gradients `m-chrome`, `m-chrome-h`, `m-chrome-ball`; CSS gradients on handles and the primary button | |
| gloss black | SVG `m-gloss`, `m-ball`; CSS gradients on drawer fronts, lid, cards | |

- **Type:** Host Grotesk (Google Fonts, 300–800), one family. Section heads 600–650 weight at about 58px with -0.035em tracking. Body 17px/1.62. Tabular numerals in every data cell.
- **Radius:** 12px for figures, 16px for panels, pills for buttons.
- **Motion:** ease-out `cubic-bezier(.16,1,.3,1)`. One authored entrance (name, then the bio rises at 1.5s, then the canvas fades in). No scroll-reveal on cards or sections. Everything rests under `prefers-reduced-motion`: name shown complete, Galton settled with its curve, no pulses.
- **Browser surfaces themed:** `::selection`, focus ring, scrollbar, underline offsets.

---

## 7. Skill conventions in force

**impeccable** (primary process):
- Mode is **Experience** (portfolio). The surface brief lives at `.impeccable/surfaces/index-html.md`. Product truth is in `PRODUCT.md`.
- Craft-floor bans to police: no eyebrow or kicker labels above headings; no gradient **text** (the chrome name is SVG lettering, which is allowed); no glass or blur as decoration (the nav's backdrop blur is functional); no colored `border-left` over 1px; no hard offset shadows; no monospace as a "technical" costume; no emoji or Unicode glyphs standing in for icons; no identical entrance on every section; contrast at or above 4.5:1 for body text.
- Finish requirements still owed (Claude will run them): `impeccable detect`, a fresh-context finish review, and DESIGN.md plus `.impeccable/design.json` written from the built result.

**tasteskill** (adopted where it fits a personal site):
- Adopted: equal left and right content edges on the `.wrap` lines; one hero entrance on load; hover micro-interactions (2px lift on project figures, 1.025 zoom inside the frame, buttons step on hover and press on click); 44px tap targets; no captions under visuals; real icons for LinkedIn and GitHub; small diagram visuals in project cards; no violet anywhere. (tasteskill's "real photographs" rule is overridden by the user's no-photos directive.)
- Waived, with reasons: "one section per screen" (a resume list is legitimately taller than one screen); the company-site page plans and dealers (this is a personal site, not a business); the gate scripts (**Node 22+ is not installed**, so `gate.mjs`, `copy-lint`, and `consistency.mjs` cannot run). If you can run Node, running tasteskill's `copy-lint.mjs` and `check.mjs` against `index.html` and reporting the output is a useful contribution.

---

## 8. File map

| Path | Responsibility |
|---|---|
| `index.html` | All markup and content. Hidden SVG `<defs>` with the shared metal gradients at the end of `<body>`. |
| `css/site.css` | Tokens, components, responsive breakpoints at 1100, 960, 860, and 720px, reduced motion. |
| `js/site.js` | Name drawing and signature, footnotes, copy email, nav (menu and active state), experience "show more", project register figure, toolbox build and selection, Lichess fetch. |
| `js/script-name.js` | Glyph table and `wordPath` / `nameSVG` connector logic. |
| `js/tools.js` | `TOOLS` (16 tool drawings plus copy), `DRAWERS` (Data, Stats, Fab & ops, Off the clock), `SHARED_DEFS` (masks, clipPath, foam-cut filter), `toolSVG()`. |
| `js/galton.js` | Canvas Galton board (12 rows, 230 balls, sprite-drawn chrome balls, fitted normal from the sample's own mean and sd). |
| `PRODUCT.md` | Product truth (audience, facts, constraints, voice). |
| `.impeccable/surfaces/index-html.md` | Direction contract for this page. |
| `serve.ps1` | Local PowerShell server (its comments are stale and still mention the ride). |

---

## 9. Status at handoff

**Done and verified in headless Edge at 1440, 1024 and 390:** hero (lettering, bio, footnotes, live status, Galton with fitted curve), Experience (two columns with a sticky Education card), Projects (four drawn figures), Toolbox (drawers, foam cutouts, hover lift, detail plate), Chess (live ratings, record bar, repertoire, CCL), Contact (email, buttons, and a large handwritten "andrew" signature on the right; no photo), and the mobile menu. No console errors. No horizontal overflow at 390.

**Fixed just after the first draft of this doc** (verify these; report them only if the fix fails):
1. Nav active link now comes from a scroll check: the last section whose top has passed 40% of the viewport (`js/site.js`, `markNav`).
2. Status line double gap: the text is now one flex item.
3. On mobile, tools are 72px wide so a 4-tool drawer fits on one row at 390.
4. `serve.ps1` comments no longer mention the ride.
5. Added `_config.yml` with `exclude` so Pages does not publish `PRODUCT.md`, `DESIGN.md`, `README.md`, `serve.ps1`, the notebook, or the zip.

6. On a 1200px laptop, the hero's footnote labels wrapped mid-phrase. They are shorter now (same facts): "purdue soccer analytics", "data mine recruit scoring", "semiconductor alliance", "purdue chess captain". The list is an auto-fit grid that drops to one column before anything wraps.
7. Five-tool drawers: one row on desktop (112px tools), 3+2 on phones.
8. `preview.jpg` is a new 1200x630 share image: a screenshot of the real hero with provenance embedded. It freezes the rapid rating at 1898 as of today; flag it if you think that will age badly.
9. `impeccable detect`: fixed the colored glow shadows (drawer LED, primary button hover, live-dot pulse, which is now a thin expanding ring) and the flat-hierarchy advisory (`h1` has a real display size). Remaining **cramped-padding** hits on `section` and `.proj-fig` are judged false positives: sections carry 80–130px of top padding, and the project figures are full-bleed drawings inside their frames. Challenge this if you can show a rendered case.

**Still open:**
- Finish review: you are acting as it. DESIGN.md and `.impeccable/design.json` will be written from the built result after your first findings pass.
- The tasteskill gate cannot run without Node 22+.

**Open questions for your judgment:**
- Does the cursive read as handwriting at 390px, and are the joins at "nd", "ng" and "rew" clean?
- Is the Galton loop calm enough to sit beside reading text, or does it pull focus?
- Do any tool drawings read as clip-art, or fail to read as their objects (stencil = Tableau, ledger = Excel, 8-ball = machine learning, stopwatch = industrial engineering, robot = agentic coding)?
- Does anything still feel like ryanrana.com's specific signatures rather than its general restraint?

---

## 10. Review checklist

- **Facts:** every number and claim traces to `PRODUCT.md`; the chess-rating rule in section 4 holds everywhere, including `js/tools.js` copy and `<meta>` tags.
- **Directives:** black, chrome and dark-green material holds on every section; dark green is never a page fill; no reintroduced 3D, audio, or ride.
- **A11y:** keyboard path through footnotes (Escape closes them; the close button returns focus), drawers (`aria-expanded`, closed trays `inert`), tools (`aria-pressed`), and the mobile menu; visible focus everywhere; the skip link comes first; `h1` text is "Andrew Nguyen" via `sr-only` while the SVG is `aria-hidden`; the Galton figure has an `aria-label`.
- **States:** Lichess failure path (block the domain and recheck), reduced motion, an open footnote at 390, every drawer opened at 390 and 1024, a long-ish tool name in the plate.
- **Performance:** the Galton pauses off-screen and on hidden tabs; DPR is capped at 2. Check for layout shift when Lichess data arrives.
- **Craft floor:** the bans in section 7, spacing rhythm (more space above headings than below), tabular figures in data, no orphaned rows or widows in key lines.

## 11. Do not

- Do not edit source files, install packages, commit, or push.
- Do not propose re-rolling the visual direction. The user has decided it.
- Do not add photography of any kind (no photos of Andrew, no stock), invented projects, testimonials, or metrics.
- Do not paste ryanrana.com code, copy, or assets into findings as suggested fixes.

---

## 12. Response log

### Round 1 (Claude, 2026-11-24), answering `codex-findings.md` of the same date

All five findings and the four direction notes were acted on. Please re-verify and mark them `[resolved]` or reopen them.

- **P1 Bridge Regression:** added as `#proj-bridge`, undated ("mini project"), using the sourced workflow line, with a points, fit and residuals figure that shows no numbers. Projects is now a 3-column grid with `tool register` as a 2-column featured card (figure left, text right): 2 + 3 at 1440, featured + 2 + 2 at 1024, one column at 720 and below.
- **P1 Escape focus:** one close path (`closeFn(restoreFocus)` in `js/site.js`). Opening a note focuses the note (`tabindex="-1"`), so Tab continues inside it. The ×, Escape and clicking the trigger again all return focus to the trigger. Verified in headless Edge: after open, `activeElement` is the note; after Escape, the trigger, with the note hidden.
- **P2 "87" score:** removed. The figure now shows seven emails meeting a rubric gate, one passing through, and a check mark. The copy states the real rule: the top 15% go forward.
- **P2 share preview:** `preview.jpg` is now a dedicated composition (`.impeccable/mocks/og.html`): the site's lettering, a settled board, "industrial engineering + statistics at purdue. chess, soccer analytics, semiconductors." and the URL. It carries no rating and no UI chrome. The og:image URL is now `?v=5`, and the card was checked at 400px wide.
- **P2 project figures and captions:** the register shows flagged records converging into a review list, and its copy adds "data quality up 7% across 22 tool attributes" (sourced). Match prep shows a 4-4-2 shape with zone weight, and its copy uses the sourced scope: 200+ athletes, 19 improvement plans, twice-weekly reports. Solar is now a one-driver-at-a-time sweep with no values and no ranking, and its copy uses the sourced "swept one at a time" line. All durations and numbers trace to the prior site.
- **Direction, phone first screen:** the bio now opens with the greeting plus the interests sentence (chess, kung fu, chip sector, coke zero) and a "please get in touch" link to `#contact`. The work list follows ("full experience" replaces "and more"). Footnotes are renumbered in reading order: interests 1–4, work 5–9. At 390×844, the greeting, the four interests and the contact link are all above the fold. The bio rises at 0.7s, while the name is still drawing.
- **Direction, toolbox as a route:** tools with a real destination carry a plain text link (Python and SQL → tool register, Excel → solar, Tableau and the wafer → experience, Probability → `#galton-demo`, Machine learning → bridge regression, Industrial engineering → education, Rapid chess → `#chess`, Soccer → match prep). The rest stay as short notes. At 1100px and below, the standalone plate is hidden and the selected tool's name, use and link render inside the open drawer, directly under its objects. Opening a drawer selects its first tool, so the detail always matches what is open.
- **Direction, Galton:** an sr-only figcaption explains the twelve left-or-right steps, the stacks, and the fitted curve. A 44px control pauses or plays the animation; under reduced motion it becomes "replay", which runs one cycle and settles. The readout uses sample notation (`x̄`, `s`) and stays empty until the pile has finished and the curve is fitted.
- **Truth fix found while doing this:** the Data Mine project no longer claims Python (the source says ETL only), and the Python tool copy now cites only Micron.

**Detector after this round:** the cramped-padding hits remain (judged false positives, as in section 9). A new `shape-assembled-illustration` hit fires on a 320x200 project figure. These are schematic data diagrams (a formation, a rubric gate, a residual plot), not illustrations standing in for an asset. Challenge this if you disagree.

### Round 2 (Claude, 2026-11-24): new user directives, then `codex-findings.md` round 2

**New pinned directives from Andrew (these supersede earlier sections where they conflict):**
9. The bio has no links or footnotes. Andrew rewrote the opening line himself: "hi there, check out some of my projects and experiences."
10. Experience shows only role, organization, dates and location: no descriptions and no "show more".
11. The tool chest is replaced by **"My backpack"**: one brown leather backpack, opened, with every item loose inside (no categories). It uses the same 16 drawn items and the same detail plate, which sits beside the bag on desktop and below it at 1100px and under.
12. Education is a compact card: a block-serif "P" in Purdue old gold (deliberately *not* the Motion P trademark), the GPA, and scholarships and certifications as chips.
13. The Galton board is gone. A **goldfish** now swims through the description and keeps the reader company across the page. Andrew said **no pause button** (this overrides the tasteskill rule and Codex's suggested control, so do not re-raise it).
14. The fish follows scroll and navigation. A click on a button, link or backpack item sends it quickly to that control, where it turns to look.

**Fish (`js/fish.js`), with Codex's recommendations applied:**
- Two viewport-fixed canvases. The back one sits under `main` (dimmed, behind text); the front one sits under the sticky nav (z 40). Page colour moved to `<html>`.
- In the hero: a figure-eight behind the copy, in front in open water. Past the hero: an upright figure-eight in the right margin, in front where the margin is at least 0.55L, otherwise behind. In the margin the fish eases to 72% size. When it is far from its loop it hurries (up to 5L/s).
- Seek, look, settle: on a click it approaches from whichever of the four sides has the most room (over and under preferred slightly on phones) and stops with the snout outside the control's rect plus a 0.14L margin. It turns to face the control, holds for about 0.7s, then returns to its loop. Same-page links target the link first, then the destination heading once that heading is on screen (4s timeout). Keyboard activation goes through the same `click` path.
- One `requestAnimationFrame` id, cancelled on stop; the loop stops when the tab is hidden.
- Reduced motion: one resting pose, no animation loop. A click repositions it instantly beside the control, and it returns to rest after 1.6s or on scroll.
- The body has a thin dark rim.

**Your round-2 findings:**
- [fixed] P1 mobile repertoire: the Moves header is hidden with its cells (`.th-moves`). Verified at 390: visible headers are Opening|Side.
- [fixed] P2 mobile menu: the blur moved to `.nav::before`, so the fixed menu now measures against the viewport (788px tall at 390x844). It gets `100dvh` height with internal scroll. Escape closes it and returns focus to the toggle.
- [fixed] P2 live dot: muted by default, green only under `.is-live`, which is set only when rapid has games > 0. The provisional "?" carries into the big readout.
- [fixed] P3 clipboard: confirmation shows only on a real copy, with the width held; failure opens `mailto:`.
- [fixed] P1 fish inside a full-width button, P2 off-screen heading, P2 frame handling: see the fish notes above.
- [obsolete] Galton pause/frames, footnote focus, tool-chest tray notes: those features were removed by directive.
- [declined by user] the fish pause control.

**Detector now:** cramped-padding (false positives, as before); `shape-assembled-illustration` (project diagrams, as before); `repeating-stripes-gradient` (the backpack lining's woven texture); `nested-cards` (the plate's figure well); `em-dash-overuse` ("—" placeholders in empty data cells). The backpack patch's low-contrast hit is fixed.

### Round 3 (Claude, 2026-11-24): directives from Andrew

15. **No Coke Zero anywhere.** The backpack item, the copy and the PRODUCT.md favorite are removed; the "diet coke and ai" footer and the robot's coke quip are also gone.
16. **More professional:** sentence case throughout, proper acronyms (SQL, ETL, DCF, NPV, OpEx), factual tool notes, and no jokes (the 8-ball's "outlook: good", "no further questions" and the AI quip are removed). His opening line is kept, capitalized: "Hi there, check out some of my projects and experiences."
17. **Experience shows the first four roles only** (Micron, Purdue D1 Women's Soccer, Semiconductor Student Alliance, The Data Mine); the hero list matches.
18. **The accent is water blue, not green** (`--accent-500 #3b9ae1`, `--accent-300 #8fc8f0`, lining `#0b2235`); the tokens were renamed from `--green-*` to `--accent-*`. Section 6's green values are superseded.
19. **A bigger fish:** L = clamp(92, 0.115·vw, 176), easing to 62% in the side lane.
- The backpack now holds 15 items: 5 across on desktop, 3 across on phones.
- Module imports are versioned (`?v=6`) because Pages caches scripts for 4 hours; an unversioned `tools.js` broke the fish for returning visitors.

### Round 4 (Claude, 2026-11-24): the skills tank

20. **The backpack is replaced by a fish tank** (`#skills`, nav "Skills", `js/tank.js`; `js/tools.js` was deleted). It holds **skills only**: soccer, kung fu movies and hiking are removed, and chess stays at Andrew's request. Each skill is an object at its own size and depth: Python is a moray eel in a rock; SQL is coral grown as a stacked-cylinder database; Chess is an old bronze knight half-buried; Tableau is kelp whose stalk heights form a bar chart; Excel is a fishing net whose mesh is a grid of cells; Probability is a pebble mound in a bell curve with a fitted dashed curve; JMP & DOE is a sunken 2^3 factorial crate; Six Sigma is a tide gauge marked UCL/CL/LCL; Machine learning is a neural-network jellyfish; Industrial engineering is sunken gears; Semiconductor fab is an open clam with a silicon-wafer pearl; Agentic coding is a survey drone. There is a hazy back row, a front row and floating mid-water objects, with light rays, bubbles and a spotlight on the selection. Below the tank, an aquarium-style brushed-steel placard shows "what it is in the tank", the skill, the tools and the use, plus a link. A row of skill chips (real buttons) mirrors the tank for keyboard and screen-reader users; the SVG is `role="img"`.
21. **The goldfish swims inside the tank** whenever the tank fills the middle of the viewport (62% size, front layer). Selecting an object (in the tank or by chip) sends it there to **stay** (`reside`): it alternates facing the object (~1.6s) with hovering beside it, chooses its waiting spot within the tank's bounds (avoiding the sand), and leaves when another thing is picked or the object scrolls off screen.
- Two layouts are rebuilt at the 720px breakpoint: a wide 1200x560 scene and a tall 600x980 scene for phones. Under reduced motion, all tank animations stop.

### Round 5 (Claude, 2026-11-24)

22. **No projects anywhere.** The Projects section, its nav link and its styles are removed, and so is the register-figure code. The opening line now reads "Hi there, check out some of my experiences." Tank notes no longer name or link projects: Python and SQL describe the Micron tool-budgeting work and link to the Micron role, Excel describes parametric and engineering-economics modeling, and Machine learning has no link. The share card line is "Experience, skills and live chess." Any reintroduced project mention is a P1.

### Round 6 (Claude, 2026-11-25): Chess section

23. **The Chess section is concise:** a "Live from lichess.org/@/an_d22" line; a stats row (Rapid, Bullet, Blitz, each with its game count, plus the W/D/L record); and a bullet-rating chart. **The CCL record and the repertoire are removed** (user directive). The logic lives in the new `js/chess.js`.
- Chart, following the dataviz skill: Lichess's `rating-history` endpoint returns `[]` for an_d22 and the game export returns 404, so no dated series is public. The page therefore draws the **all-time range** that `/api/user/an_d22/perf/bullet` does publish (low with date, peak with date, live current), plus the percentile. Nothing is interpolated. If `rating-history` ever returns Bullet points, the code draws a dated line chart instead (2px line, 10% wash, solid hairline grid, end-value label, crosshair tooltip, sr-only monthly table). Large stat figures use proportional digits per the skill.

### Round 7 (Claude, 2026-11-25): shipped Codex's fish and shading

- Reviewed Codex's dimensional fish, water-shaded background and tank lighting: no console errors at 1440, 390 or under reduced motion; the fish draws at 0.26 ms/frame (the old one took 0.11 ms).
- **Perf fix:** the frame rate dropped to ~36fps in software rendering. The cause was `filter: blur() saturate()` on the full-viewport `.fish-back` canvas (it re-filters the whole screen every frame), not the fish art. The filter is removed; opacity alone gives the depth. 60fps at both 1440 and 390. Do not reintroduce CSS filters on the fish canvases.
- Share image refreshed from the new renderer with a gutter around the fantail (`preview.jpg?v=9`).
- Still open from Codex's 2026-11-25 findings: P1 mobile skill selection can send the fish off screen; P1 the open mobile menu leaves the page behind focusable; P2 the "See education" anchor; P2 chess stats wait for the history request; P2 placard order (skill first). Next round.

### Round 8 (Claude, 2026-11-25)

24. **The eye is fixed, and the fish moves in 3D.** `drawFish` no longer infers its view from screen direction (that flipped it between profile and top-down at 90°/270° and put the eye on the belly side). The caller now passes `bank`: its sign keeps the back up (with hysteresis, smoothed so the fish rolls through when it reverses) and its size is how side-on the fish is. The eye sits on the dorsal half; both eyes show only when the fish swims toward or away from the viewer. A new depth value `z` (0 = far, 1 = near) scales the fish from 70% to 112%, foreshortens the body when its motion is mostly in depth, and decides which layer it draws on in the hero (behind the copy when far, in front when near). 60fps.
25. **Skills:** Industrial engineering and Probability are removed (10 remain). The placard is removed. Each skill now plays a looping demo in a dark window (`js/demos.js`): Python types a script, runs it and plots a random walk; SQL rows move from three silos into a joined table; Chess plays the Goring Gambit; a Tableau bar chart re-cuts on a filter; an Excel model computes a real NPV (13.82); a JMP DOE 2^3 design runs in randomized order; an SPC chart flags an out-of-control point; ML fits a logistic boundary live; a wafer scan sorts dies; and a Claude Code terminal session runs. The demos pause off screen, show their final state under reduced motion, and use generated data only.
- A regex in this round briefly deleted the 720px mobile-menu rules; they are restored and verified (the toggle shows and the menu is 788px tall at 390).
