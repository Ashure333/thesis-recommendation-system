/* ============================================================
   CHANGELOG — single source of truth for recent changes.
   The Changelog tab renders these entries, and both wikis
   (Walkthrough & Engine) cite them by id via WikiCite, so a
   change gets one id here and one citation per wiki.

   `body` is the one-line summary shown on the card. `details`
   holds the engineering specifics (files, functions, the actual
   math) and stays collapsed until the reader opens the entry.
   Entries without `details` are one-liners and render no toggle.
   ============================================================ */

export type ChangeTag = "NEW" | "FIXED" | "ENHANCED";

export interface ChangelogEntry {
  id: string;
  date: string;
  title: string;
  body: string;
  details?: string[];
  tag: ChangeTag;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "oak-default-acorn-to-ancient",
    date: "Oct 6",
    title: "Oak: from acorn to ancient oak",
    tag: "ENHANCED",
    body:
      "The Garden's default tree is now the Oak, rendered from the " +
      "acorn reference exactly: an acorn bedded in the soil, a " +
      "seedling's wide crown, seven-lobed oak leaves, acorns that " +
      "drop with the leaf fall, and up past the giant the ancient " +
      "oak's bark — darker ridges, moss seams, fungus shelves, and " +
      "amber glows blinking through the ascent's value-noise wood.",
    details: [
      "The oak's art data is ported verbatim: trunk profile (11 points, widths to 130), twelve branches incl. the basal roots, 24 canopy clusters (2.8-4.2 leaf size) plus two ground clumps, the 7-lobe leaf sprite, olive pollen cream, and the acorn ground sprite.",
      "The renderer is now species-parameterized: each skin carries its own art table (lobe count/amplitude, world-bark cells, moss, lichen, fungus, blink palette, trunk weights, cluster birth centre) — oak uses the reference's exact palettes and world-bark colours; crimson/others keep theirs.",
      "Stages: Acorn, Seedling, Sapling, Young oak, Mature oak, Giant, Ancient oak — still one fertilizer packet per 2.5-second timeline step.",
      "The Garden layout is a warm panel: the tree stage front and centre with a sticky shop rail beside it.",
      "Verified: the acorn sits in the soil at 0 packets (79 px with the acorn's 2x2 sprite), sapling 1399 px, giant 9312 px, ancient 7116 px, oak is the planted default, markers read Acorn..Ancient oak, shop rail beside the tree, no console errors.",
    ],
  },
  {
    id: "garden-seed-to-world-tree",
    date: "Oct 6",
    title: "The Garden grows from seed to world tree",
    tag: "ENHANCED",
    body:
      "The Lab now opens a Garden tab that hosts the tree and the " +
      "shop side by side, and the tree is the full Crimson Tree: from " +
      "seed to sapling to young tree to the giant, then the world-tree " +
      "ascent — the pixel camera climbs the trunk through per-pixel " +
      "bark with value-noise rings, lichen, moss and blinking leaf " +
      "lights, pollen dust raining down as it rises.",
    details: [
      "The reference's full pipeline is ported verbatim: growth (P in 0..0.46), zoom into the giant (0.46..0.66, Z to 4.2), then the ascent (0.66..1, camera up 2800 world-units).",
      "Every fertilizer packet is one step of the reference's 50-second timeline — one packet is a smooth 2.5-second sweep, so progress reads clearly at every stage: Seed, Sprout, Sapling, Young, Mature, Giant, World tree (the marker strip now shows those stage names).",
      "The old striped lawn is gone: a clean garden bed shows the tree over a soft soil slope, with the seed bank, speech bubble, resize grip, and the grown-tree pan/zoom viewer kept.",
      "Skins survive: the palette tables (bark, foliage, moss, cream, world-bark BK/MS/LICH) are derived per species, with crimson using the reference's exact colors.",
      "Verified at each stage: 0 fert → seed speck (51 px), 2 → sprout (266), 5 → sapling (1219), 9 → mature canopy (5429), 10 → giant zoom (6187), 14 → world-tree bark (7894), 20 → summit (4997); a single fertilizer animates smoothly with no console errors.",
    ],
  },
  {
    id: "crimson-sprites-parity",
    date: "Oct 6",
    title: "The tree is the reference's tree",
    tag: "ENHANCED",
    body:
      "The Tree of Knowledge now sits in its own 128x128 window, " +
      "relative and resizable, and every sprite matches the Crimson " +
      "Tree reference: the default tree is now a crimson maple with " +
      "the reference's exact palette, the original painter's per-pixel " +
      "bark shading and moss gate, its sine-dotted trunk, its seed " +
      "specks, its pollen dust, and falling leaves that land at the " +
      "reference's ground line, stepping through the original growth " +
      "timeline at its own pace.",
    details: [
      "The 128x128 window scales from a 96-336px grip (bottom-right corner, persisted), stays relative to the card, and keeps pan (once grown) and 1x-2x zoom.",
      "Sprite parity: raw 800-space scaling (no pivot drift), hash(px,py) bark noise and hash(px+9,py+3) moss gate verbatim, moss accent #4f5340, the dotted trunk pass (sine drift over u in [0.04, 0.6]), seed specks [120,84,62]/[96,66,50], 280 pollen sprites, leaf-fall pool y<90 and ground line 116-122.",
      "Crimson maple is the free default (the reference's palette: BARK #221b2b-#5a4e66, RED #3f0614-#ff3345); Oak, Birch, Elm, and Redwood stay purchasable skins.",
      "Verified vs the reference at t=1: the trunk has zero shade mismatches and 88.8% exact-color pixels (the rest is per-run random fall and leaf edges); every fertilizer is a step on the original's growth timeline, animated from where the tree stands at the reference's own pace.",
    ],
  },
  {
    id: "tree-viewer-close-pan-zoom",
    date: "Oct 6",
    title: "Close the chatter, then wander the tree",
    tag: "ENHANCED",
    body:
      "The tree's speech bubbles — trivia, grove lines, and the plain " +
      "prompt — all carry a close button now. Shut them and the tree " +
      "stands silent for you: once it has grown, drag to pan around " +
      "it and zoom between 1x and 2x with the buttons or the wheel.",
    details: [
      "Every bubble (including the default 'Ask the tree' prompt) has an x that hides it entirely; idle speech pauses while closed, and 'Ask the tree' or a click on the tree brings it back.",
      "Viewer unlocks at ~75% growth: drag pans the crown around (pointer-captured, click-vs-drag aware), wheels and +/−/1x buttons zoom 1x-2x centered on the crown, and the reset chip returns to a full view.",
      "All of it composes with the world-tree zoom phase and the idle sway and falling leaves; the view resets if the tree changes species.",
      "Verified: prompt closes and reopen via ask/click, zoom 1.5x raises coverage, a drag moves the centroid while zoomed, reset snaps back, and the idle loop stays paused while the bubble is closed — no console errors.",
    ],
  },
  {
    id: "tree-idle-speech",
    date: "Oct 6",
    title: "The tree speaks between silences",
    tag: "ENHANCED",
    body:
      "After you ask the tree, its answer holds for a minute of idle, " +
      "then it falls quiet — and while you wander the lab it speaks " +
      "on its own, like the pet: short grove lines in the same speech " +
      "bubble, each arriving on a random gate from one second to two " +
      "minutes, held open just a few seconds, over the same idle sway " +
      "and falling leaves.",
    details: [
      "A minute after the last ask, the trivia bubble auto-dismisses.",
      "Ambient grove lines then appear at random 1s–2min intervals and linger ~6-8s; a new line waits while you hover the tree, and the schedule always lets the trivia answer go first.",
      "The lines are STE-style grove lore ('Every ring remembers a feed.'), tagged GROVE LORE in the bubble, riding the crown along with the trivia.",
      "Verified with accelerated timers: prompt → line cycle runs, ask shows the trivia, the minute-long hold dismisses, and the idle loop resumes — no console errors.",
    ],
  },
  {
    id: "sapling-to-tree-bridge",
    date: "Oct 6",
    title: "From seed to sapling to tree",
    tag: "ENHANCED",
    body:
      "The tree's first act is now its own little story, straight " +
      "from the Crimson Tree sapling: two dark specks in the soil, a " +
      "bark tuft, a thin species trunk, drifting pollen dust, and one " +
      "big first leaf. Then the bridge — the sapling scales up and " +
      "melts into the mature tree as the sun keeps feeding it.",
    details: [
      "The sapling plays on the first stretch of the sun-driven growth (under ~165 sun): the seed speck, the tuft mound at the base, the trunk grown from the root at sapling scale, cream pollen-dust popping in around the crown, and the reference's big round first leaf that recedes once the canopy takes over.",
      "The bridge scales the sapling from 20% to full size while the mature tree's pixels unpack beneath it; the sapling fades out and the canopy's density ramp finishes the look — then the idle sway and falling leaves take over.",
      "Species skins still show: the sapling's trunk and first leaf use the species palette, while the pollen dust keeps the reference's cream tones.",
      "Verified: resting at 0 sun shows the seed speck, at ~120 sun the sapling mid-march (cream dust + young foliage), and the full sweep matures with its falling-leaf idle.",
    ],
  },
  {
    id: "knowledge-rides-height",
    date: "Oct 6",
    title: "The tree knows only as deep as it has grown",
    tag: "ENHANCED",
    body:
      "The Tree of Knowledge's wisdom is now bounded by its height: " +
      "a 1-foot seedling can only share the first tier of trivia, at " +
      "100 feet it reaches the second, 300 feet the third, and a " +
      "1000-foot elder knows everything it can hold. The speech " +
      "bubble rides along — low over the sprout, climbing the canopy " +
      "as the tree grows, settling under the crown as it rises into " +
      "the world tree.",
    details: [
      "Knowledge tiers follow height (100 / 300 / 1000 ft) instead of abstract points, in the tree panel and the Sun Shop; growth points remain the cosmetic growth counter.",
      "The bubble's tail tracks the crown: it eases upward with each growth marker, gains a nudge from the tree's feet and the zoom phase, and its trivia line still labels the topic and species.",
      "Verified: the seed hands 1/13 tier-0 trivias, a 121-ft sprout 1/29, and the bubble rises ~160px from seed to elder with intermediate heights between.",
    ],
  },
  {
    id: "summer-of-tokens-skins",
    date: "Oct 6",
    title: "The tree grows with sun; skins grow with tokens",
    tag: "ENHANCED",
    body:
      "The Lab's tree no longer plays on its own: its growth is the " +
      "sun it consumed. Fertilizer pushes it through visible growth " +
      "markers — Seed, Sprout, Sapling, Elder tree — and beyond the " +
      "Elder tree it keeps rising into a world tree. While it waits, " +
      "it breathes and sways with a quiet idle. And the other species " +
      "are now skins, bought with a new growth-token wallet that the " +
      "app itself keeps filling.",
    details: [
      "Growth is spent sun: markers at 100, 240, and 400 sun; the growth sweep animates between markers, and leftover sun zooms into the world tree with a full leaf shower (the extended Crimson Tree finale).",
      "The scrubber, Replay, and Pause controls are gone. The canopy sways idly, and falling leaves return once the tree is fully grown.",
      "Tree skins: Oak is free; Birch, Elm, and Redwood cost 25, 40, and 60 growth tokens, bought in the Sun Shop or the tree's seed bank.",
      "Growth tokens come from using the app: +3 each new day, +1 per finished battle (3/day), +1 per 5 tree asks (3/day), +1 per treasure and achievement — every shop item comes home in time.",
      "Reset progress still clears the tree's trivia and regrows it; sun and skins stay.",
    ],
  },
  {
    id: "crimson-tree-growth-reset",
    date: "Oct 6",
    title: "Tree of Knowledge grows like the Crimson Tree",
    tag: "ENHANCED",
    body:
      "The Lab's tree is now a procedural pixel tree, grown from " +
      "the root up with the Crimson Tree's technique: catmull-rom " +
      "limbs, five-tone species palettes, canopy clusters that pop " +
      "in at their birth time, and falling leaves once it is fully " +
      "grown — controlled with Pause, a growth slider, and Replay. " +
      "A Reset progress button clears the tree's learned trivia and " +
      "grows it back from the seed.",
    details: [
      "The canvas tree mirrors the reference: 192x192 pixel art, image-rendering pixelated, limbs drawn per species (Oak crown, birch's pale slender trunk, elm vase, redwood tiers), roots thicken with the tree's height, and a leaf-fall + landing-pile loop runs at full growth.",
      "Species, stage, and height feed the same economy as before — only the look changes; the seed-bank mini trees and trivia tiers are untouched.",
      "Reset progress confirms first, then clears paperrec_knowledge_trivia (+ the legacy key), resets the trivia state, and replays the growth animation; hunt, sun shop, and achievements are untouched.",
      "Verified: growing frames differ, controls work, one Ask stores a trivia, reset clears it and restarts growth with no console errors.",
    ],
  },
  {
    id: "instant-known-tips-quiet-interaction",
    date: "Oct 6",
    title: "Known tips appear instantly; the pet goes quiet on interaction",
    tag: "ENHANCED",
    body:
      "Hovering a tip you have already recorded now opens the panel " +
      "immediately — no 1-second dwell for tips you know. The pet " +
      "also stops its idle chatter while you interact with it: " +
      "hovering or dragging it, opening its menu, or dwelling on a " +
      "tips target pauses the speech cycle.",
    details: [
      "The hover engine short-circuits: seenRef includes the id (and the chat unlock is off) → reveal() runs on enter, skipping HOVER_DELAY_MS, the dwell ring, and the reveal cooldown.",
      "Measured: a recorded tip's panel appears ~0.08 s after hover (the dwell path waits ~1 s).",
      "The idle talk interval now early-returns when hovering, dragging, the pet menu is open, or a tips target is currently dwelt",
    ],
  },
  {
    id: "tooltip-delay-pet-toggle",
    date: "Oct 6",
    title: "Tooltip delay is 1 second; pet can be toggled off",
    tag: "ENHANCED",
    body:
      "Hovering a tip now awaits just one second before the panel " +
      "appears. The pixel pet also gained a Settings toggle (persisted " +
      "per browser), and pet clicks always respond: clicking while the " +
      "tip is still typing closes it instead of doing nothing, and the " +
      "post-drag click swallow shrank to 300ms.",
  },
  {
    id: "copy-trim-paper-disposal",
    date: "Oct 6",
    title: "Paper-disposal wordings trimmed",
    tag: "ENHANCED",
    body:
      "The per-form flavor copy about how each pet form destroys " +
      "papers is gone. Dragging a paper onto the pet now simply " +
      "removes it from your library; the walkthrough pages say the " +
      "same in plain words.",
  },
  {
    id: "workspace-readjustment",
    date: "Oct 6",
    title: "Search workspace readjusted, padding trimmed",
    tag: "ENHANCED",
    body:
      "Researcher Search lost its sidebar width in the revert and " +
      "crushed the results column; the three-pane row is back (query " +
      "288 / results / similar 384). Padding is trimmed and the shell " +
      "widened so the workspace fills the available space.",
    details: [
      "The query console (and Repository filters) regained lg:w-[var(--pane-left)]; the results column went from a crushed sliver back to a real flex-1 column.",
      "The app shell now caps at 1560px with tighter padding (px-3/py-5 desktop, reduced pane gaps and inner padding), and the panes' height fills the viewport exactly (bottom = viewport height at 950px).",
      "Researcher search at 1700px: 288px console, 8px handles, 784px results, 384px similar-papers pane on a 1520px workspace (was 1352px).",
    ],
  },
  {
    id: "layout-revert-readjust",
    date: "Oct 6",
    title: "Layout reverted and readjusted",
    tag: "ENHANCED",
    body:
      "The grid restructure was rolled back — Search and Repository " +
      "run the previous layouts again: the resizable three-pane search " +
      "and the library single-column search, the Repository pane set " +
      "with its filter sidebar and consistent footer, all without the " +
      "rounded grid shell.",
    details: [
      "Search: the resizable query console, the results middle pane, and the similar-papers pane are back side by side in Researcher mode; Library mode keeps the single-column search.",
      "Repository: the filters pane (with its resize handle), the paper list, and the details pane are back in their original arrangement.",
      "The mobile work is kept: no narrow-screen blocker, stacked panes under lg, horizontally scrollable wide tables, and touch long-press menus.",
    ],
  },
  {
    id: "top-nav-icons",
    date: "Oct 6",
    title: "Top nav items get icons, Search through Changelog",
    tag: "ENHANCED",
    body:
      "Every top-bar menu item now carries its own pixel-drawn icon — " +
      "Search, Repository, Upload, My Library, Arena, Lab, " +
      "Walkthrough, Engine, FAQ, Settings, Changelog. The active item " +
      "swaps its icon for the animated arrow; locked items keep the " +
      "padlock; feature gating, badges, and mode filtering are " +
      "unchanged.",
  },
  {
    id: "library-single-column-search",
    date: "Oct 6",
    title: "Library search is now a single column",
    tag: "ENHANCED",
    body:
      "Library mode replaced the three-pane search with one column: " +
      "announcements, one big search bar, results full width, and " +
      "the similar-papers workbench as a section below. Researcher " +
      "mode keeps its three panes untouched.",
    details: [
      "The librarian column: a full-width search card (mode chips, big input, Search button, top-K select), the results list full width, and the connections workbench as a section under the results — no side panes.",
      "The Results / Connections / Stats for Nerds tabs still work inside the column; announcements stay on top.",
      "Researcher mode's query console, pipeline picker, dials, MMR, and resizable panes are unchanged.",
    ],
  },
  {
    id: "announcements-on-library-search",
    date: "Oct 6",
    title: "Announcements now ride on the library search",
    tag: "ENHANCED",
    body:
      "Because the RE:SEARCH home button lands on the librarian " +
      "search, Library mode puts the staff announcements at the top " +
      "of the Search page (and on the Library Welcome page, which " +
      "shares the same panel). Researcher mode stays clean.",
    details: [
      "A shared AnnouncementsPanel now backs both surfaces: the Search page in Library mode (compact, above the page tabs) and the Library Welcome page.",
      "Sign-in lands on the same page, so new visitors see the announcements first, then the search — no separate welcome detour.",
      "Verified live with a seeded announcement: visible on the Search page in Library mode, absent in Researcher mode, still shown after clicking the RE:SEARCH logo.",
    ],
  },
  {
    id: "home-button-search",
    date: "Oct 6",
    title: "The RE:SEARCH home button opens the librarian search",
    tag: "ENHANCED",
    body:
      "The logo in the top bar now points to the Search page in both " +
      "modes — the librarian version of the search in Library mode — " +
      "instead of the welcome page. The Library Welcome page remains " +
      "the post-login landing and the announcements surface.",
  },
  {
    id: "ste-copy-pass",
    date: "Oct 6",
    title: "Copy edited to Simplified Technical English",
    tag: "ENHANCED",
    body:
      "The help library, FAQ, page descriptions, empty states, tips, " +
      "and pet lines now follow ASD-STE100: short sentences, active " +
      "voice, no contractions.",
    details: [
      "The stop-slop skill gained an ASD-STE100 reference (references/asd-ste100.md): the rule summary, the procedure/description limits (20/25 words), UI mappings for buttons, errors, and tooltips, and a delivery checklist.",
      "FAQ answers and the pet help library were rewritten as short active sentences with one instruction per step; the help-entry keywords are unchanged, so the chat matching still works.",
      "Page descriptions, empty states, and status copy were tightened; every contraction was removed from user-facing strings, including tips, pet lines, and tooltips.",
    ],
  },
  {
    id: "developer-tempest",
    date: "Oct 6",
    title: "The developer is dubbed TEMPEST",
    tag: "ENHANCED",
    body:
      "Credits now name the developer as TEMPEST — the Walkthrough " +
      "and Engine infoboxes, the boot-screen byline, and a pet " +
      "help-library entry.",
  },
  {
    id: "pixel-form-fonts",
    date: "Oct 6",
    title: "One font for the chrome: Pixelify Sans where it counts",
    tag: "ENHANCED",
    body:
      "Buttons, inputs, placeholders, and paper titles now run " +
      "Pixelify Sans like the rest of the retro chrome — body " +
      "paragraphs deliberately stay Inter for readability.",
    details: [
      "A base rule puts every button, input, select, and textarea on Pixelify Sans (with a touch of tracking), so placeholder text matches the typed text; placeholders keep their smaller size.",
      "Paper titles (Repository table and My Library rows) and page headings join the pixel font; stat labels, chips, and console text already used it through the themed mono stack.",
      "Long-form body copy deliberately stays Inter — a display font at paragraph sizes hurts readability.",
    ],
  },
  {
    id: "stats-for-nerds-tabs",
    date: "Oct 6",
    title: "Stats for Nerds: the pseudocode, tabbed everywhere",
    tag: "ENHANCED",
    body:
      "The mathematical pseudocode moved out of the page footer and " +
      "into its own Stats for Nerds tab on Search, Arena, and Lab — " +
      "and on the Repository it lives in a toggleable right-side pane " +
      "that recomputes live as you search.",
    details: [
      "Search: the pipeline math that used to sit below the three panes is now the third page tab (Results | Connections | Stats for Nerds), with the live trace running the current query.",
      "Repository: a Stats for Nerds toggle in the page header (persisted per browser) swaps the right pane between paper details and the live stats. Because the repository search is real-time, the pane plays a short COMPUTING animation on every keystroke/filter change, then steps in a snapshot (papers, valid counts, year span, document-type bars) plus the pipeline pseudocode with a live trace of the current query.",
      "Arena gained Battle | Stats for Nerds with a live trace for the battle query; Lab's tab row grew a fourth tab so the recipe dials' math follows the live weights.",
      "All placements render the shared StatsForNerds component: a mode chip (codename + pipeline id), an opened-by-default Mathematical pseudocode card, and a page-specific context note.",
    ],
  },
  {
    id: "web-graph-complex-connections",
    date: "Oct 6",
    title: "Web graph parity: Similar Papers header + real connections",
    tag: "ENHANCED",
    body:
      "The web scope now shows the same Similar Papers header and " +
      "copy as the local graph, and its nodes form complex clusters — " +
      "citing links, shared references, and co-citations — instead of " +
      "a plain star.",
    details: [
      "The web graph header reads 'Similar Papers' with the same description ('Similar papers cluster together. Selecting a node highlights the similarity path back to the origin.') and related-count badge as the local graph.",
      "Backend /api/papers/{id}/web-connections now returns an edges list derived from the OpenAlex reference lists already fetched: citer → prior links ('cites'), bibliographic coupling between priors ('coref', shared references ≥ 2), and co-citation between citers ('cocite', shared references ≥ 2).",
      "The web canvas draws that structure — solid edges for center links, dashed for citing links, thin weighted edges for shared-reference structure — so clusters form the way they do locally (live sample: 56 edges over 30 nodes versus 29 for a star).",
      "Local prior/derivative lists now show real titles: the backend resolves unmatched work ids against OpenAlex in one batch, cached in-process — offline, the ids/DOIs remain.",
      "The big-tab local canvas now shares the web aspect (900×520 instead of widening the tall 560×440 pane canvas), and the details card scrolls itself into view, is click-through (never blocks nodes underneath), and closes on Escape, outside click, or its X — the zoom animates back with it.",
      "Local graph footer copy no longer references the ranked list when the tabbed workbench hides it.",
    ],
  },
  {
    id: "connections-workbench-zoom",
    date: "Oct 6",
    title: "Connections workbench: big tab, web parity, click-to-zoom",
    tag: "NEW",
    body:
      "The similar-papers view moved out of the narrow pane into a " +
      "full-width Connections tab on Search, with Prior works, " +
      "Derivative works, and Contrast as separate tabs — and the web " +
      "graph now matches the local one, including click-to-zoom with " +
      "an auto-focused details pop-up.",
    details: [
      "Search gained page tabs: Results | Connections. The Connections tab is a full-width workbench beside the query sidebar; the Repository record pane keeps the compact version with a Full view button that jumps to the big tab centered on that paper.",
      "Prior works, Derivative works, and Contrast are now separate tabs (with counts) instead of stacked sections; each works list carries its own Download, graph-paper rank chips, and a Show-in-graph jump.",
      "The WEB graph was rebuilt in the local graph's language: d3-force layout, ink center, numbered prior nodes, lettered derivative nodes, node size by OpenAlex citation count, hover dimming, and the same legend.",
      "Click a numbered node: the canvas animates a zoom toward it (translate + scale 1.9, eased) and a details pop-up appears — auto-focused like the pet's right-click menu. Escape, an outside click, or clicking the node again dismisses it and the canvas zooms back out; identical on LOCAL and WEB.",
      "Details cards show title, authors, year, similarity (local) or OpenAlex citation count (web), DOI and OpenAlex links, and an abstract snippet (local records).",
    ],
  },
  {
    id: "literature-menu-settings",
    date: "Oct 6",
    title: "Literature menu, mode switch screen, and Settings",
    tag: "NEW",
    body:
      "Switching modes now plays a loading screen, right-clicking " +
      "selected papers opens a pet-style action menu (update, open, " +
      "rename, merge, mark, copy citations), and a new Settings tab " +
      "holds the preferred citation style.",
    details: [
      "Mode switch: clicking LIBRARY / RESEARCHER plays a short loading screen with a stepped progress bar while the feature menu refreshes in the background, then applies the mode and the type scale together.",
      "Right-click selected papers in the Repository or My Library for the literature menu — Update details (re-runs backend enrichment, then the rows refresh), Open file (in-app viewer), Open file externally, Open containing folder (Finder / Explorer / xdg-open, run by the local backend), Rename document files (title / author-year / author-year-title / custom patterns, collision-safe), Merge documents (the duplicate-merge engine: best metadata wins, library entries and citations repoint to the master), Mark as valid / not valid for recommendation, and Copy as — formatted citation, BibTeX, or LaTeX \\cite.",
      "Formatted citations copy as rich text: the clipboard carries an HTML flavor with the style-correct italics — standalone works (theses, reports, books) get an italicized title in every style, while articles keep their plain (APA) or quoted (MLA / Chicago / IEEE) titles — so Word and other rich editors keep the italics on paste. A clean plain-text flavor is written alongside.",
      "The menu mirrors the pet's double-click console exactly — same panel, mono type, chip items, scale(0.75), and close behavior. Verified property-by-property: background, font stack, text color, border, padding, width, transform, and item chip styling all match.",
      "Settings tab: preferred citation style (APA 7 / MLA 9 / Chicago / IEEE) drives the default Copy-as formatted citation, plus DOI-in-citation and BibTeX-abstract toggles and the default connections scope. Stored per browser.",
      "Backend: five batch endpoints — /api/papers/refresh-metadata, /reveal, /rename-files, /mark, /merge — with 11 new unit tests.",
    ],
  },
  {
    id: "connections-prior-derivative",
    date: "Oct 6",
    title: "Connections: prior and derivative works, local and web",
    tag: "NEW",
    body:
      "The similar-papers pane became a full connections surface, " +
      "shared by Search and Repository: a LOCAL graph from the " +
      "repository and a WEB graph live from OpenAlex, each with prior " +
      "works and derivative works you can cross-highlight and " +
      "download.",
    details: [
      "Scope switch LOCAL / WEB in the pane header (persisted per browser). LOCAL uses the repository's own graph plus cached OpenAlex citations; WEB resolves the paper's DOI live against OpenAlex.",
      "Prior works: the external works most commonly cited by the papers in the graph, clustered server-side from the cached citation store — the seminal background of the field. Derivative works: the works citing the most papers in the graph — surveys and recent follow-ups.",
      "Cross-highlighting works both ways: selecting a prior work paints the graph papers that reference it (and dims the rest); selecting a graph paper highlights its referenced prior works — and the same for derivative works. Graph-paper chips carry the rank numbers.",
      "Both lists export as CSV with the Download button.",
      "WEB scope draws a radial connection graph — center paper in the middle, references numbered above, citing works lettered below — sorted by OpenAlex citation count so seminal and survey papers surface first. Its Contrast tab pairs the center with any neighbour.",
      "The Repository record pane gained a fourth tab (Details / Notes / PDF / Similar) hosting the same pane, so connections work from both surfaces.",
      "Backend: the similar-graph endpoint now returns clustered prior/derivative works (no network, read from PaperCitation), and /api/papers/{id}/web-connections serves the live OpenAlex neighbourhood (400 without a DOI, 502 when OpenAlex is unreachable; injectable fetch keeps tests offline).",
    ],
  },
  {
    id: "library-researcher-modes",
    date: "Oct 6",
    title: "Library mode, Researcher mode, and the site editor",
    tag: "NEW",
    body:
      "The app now has two faces: a visitor-friendly Library mode " +
      "with announcements, and the full Researcher mode behind a " +
      "toggle. Library staff sign in at /admin to post announcements " +
      "and decide which features show, lock, or hide.",
    details: [
      "Library mode (the default) opens on a new Library Home: staff announcements, one search box that drops straight into ranked search, and quick links to Repository, My Library, and FAQ.",
      "Library mode reads as its own place: a larger type scale across the whole app, while Researcher mode keeps the dense console scale.",
      "Pro tabs are hidden from the Library nav out of the box — the admin can still choose shown / locked / hidden per feature (locked shows a padlock that advertises Researcher mode). Researcher mode always has everything.",
      "Researcher-grade controls (pipeline presets, dials, MMR) are hidden on the Search pane in Library mode; the librarian picks the ranking, the visitor searches.",
      "The site editor at /admin is real: PBKDF2-hashed credential, HMAC-signed bearer token with 12-hour expiry (server-enforced on every admin call), announcement manager with reorder and activate/deactivate, a ten-feature lineup matrix, and password rotation.",
      "First boot seeds the admin account (default admin/admin — rotate it in the editor) and persists the feature defaults in site_settings.",
    ],
  },
  {
    id: "contrast-tab-boot-flicker",
    date: "Oct 6",
    title: "Contrast tab for similar papers, boot screen flicker fixed",
    tag: "NEW",
    body:
      "The similar-papers pane now switches between GRAPH and " +
      "CONTRAST, and the boot screen no longer flickers the login " +
      "page through the dark overlay.",
    details: [
      "Contrast tab: pick any ranked similar paper and compare it side-by-side with the center — metadata rows, keywords with shared terms highlighted, abstracts, and the TF-IDF / S-BERT / metadata score breakdown behind its rank.",
      "Shared terms are judged on significant words, so 'neural networks' and 'neural network models' still light up as related; the center column reports how many terms overlap.",
      "The Contrast/Graph choice persists per browser, and re-centering works exactly like the graph: click any result's rank badge.",
      "Boot screen: the flicker animation dipped opacity, which let the login page visibly flash through the overlay every 2.4 s — it now dips brightness instead, so the screen dims without going transparent.",
      "Pre-paint background: the document loads dark when the boot splash will play (otherwise the stored palette canvas), removing the white flash before the stylesheet loads.",
    ],
  },
  {
    id: "pane-drag-revamp",
    date: "Oct 5",
    title: "Pane drag fixed, Search and Repository revamped",
    tag: "FIXED",
    body:
      "The right-side resize handles no longer drag inverted, and " +
      "the Search and Repository pages picked up the console " +
      "header and cartridge-chip design language.",
    details: [
      "Pane handles take a direction: the details and similar-papers handles now grow their pane when dragged left (verified 384 to 484), while left-side handles stay natural (256 to 336 on a right drag).",
      "Search: the query pane gained a Query console header bar, and the Keyword/Title/Seed tabs are now icon-led cartridge chips on a canvas track with a pressed-in accent state; the page header shows a pixel search badge.",
      "Repository: the Filters pane is a Filter console with a sliders badge, the Repository/Web scope toggle is icon-led cartridge chips (database/globe), the results bar carries a table/globe glyph, and the page header gained a database badge.",
      "Both pages keep every behavior: mode switching, scope toggling, filters, and pane persistence all verified after the restyle.",
    ],
  },
  {
    id: "records-five-per-page",
    date: "Oct 5",
    title: "Five records per page, and the Re:Search Laboratory",
    tag: "ENHANCED",
    body:
      "Battle history shows five runs per page on both surfaces — " +
      "the Arena's records table and the Lab's board — and the " +
      "Recipe lab is renamed Re:Search Laboratory.",
    details: [
      "Arena records: the history table pages five runs at a time, newest first, with the existing footer showing the page and total.",
      "Lab board: the simulations list gained real pagination at five per page (state clamps when runs are added or the list shrinks), with the same Pagination component as the Arena.",
      "The Lab tab and page header now read Re:Search Laboratory; the Tree of Knowledge and Sun Shop tabs are unchanged.",
    ],
  },
  {
    id: "arena-result-tabs-citations",
    date: "Oct 5",
    title: "Arena results in tabs, with citation-ready interpretations",
    tag: "NEW",
    body:
      "Battle results are separated into a scrollable tab bar — " +
      "Winner, Consensus, Pairwise, Battle grid, Scores, " +
      "Interpretation, Records — and the Interpretation tab writes " +
      "the run up in APA, MLA, Chicago, and IEEE.",
    details: [
      "Each result type renders in its own panel behind a numbered, icon-led cartridge rail (Winner, Consensus, Pairwise, Battle grid, Scores, Interpretation, Records) that scrolls sideways when narrow; a new battle resets to the Winner tab and each panel drops in with the step animation.",
      "Interpretation writes the run up four ways: a verbose APA-style paragraph built from the live numbers (pipelines compared, winner and consensus share, strongest and weakest pairwise agreement, broadest-consensus paper, weighting rationale) plus MLA, Chicago, and IEEE citations, each with one-click Copy buttons and a Copied confirmation (verified against the clipboard).",
      "Battle history's Winner column now aligns: every row's chip is a full-width truncating block, so codenames share one left and right edge (measured 836/1058 on every row) instead of drifting with chip width.",
      "Pairwise cards keep their wrapped, truncating layout, so no text collides or spills at 1440/1100/1024 (measured zero overlaps at all three widths).",
    ],
  },
  {
    id: "lab-experiments-presets",
    date: "Oct 5",
    title: "Lab experiments, starter recipes, and layout polish",
    tag: "ENHANCED",
    body:
      "The recipe bench gained an Experimental panel and five " +
      "pre-loaded recipes to battle, the pairwise cards stop " +
      "colliding at any width, and the Tree of Knowledge is " +
      "centered on its lawn.",
    details: [
      "Experimental: a Diversify toggle with a λ slider reranks EVERY pipeline of a repository battle with maximal marginal relevance (compare endpoint now forwards mmr_lambda/mmr_pool to each run, covered by test/test_compare_mmr.py); a Load-learned-weights button drops the citation-benchmark recipe (10/90/0) straight into the dials.",
      "Starter recipes seeded once per browser: Lexical Purist, Semantic Purist, Even Split, Citation Winner, and Bibliographer — each tagged preset, loadable in one click, deletable like any saved recipe.",
      "Pairwise agreement cards wrap their chips and stats and truncate long pipeline ids, so no text overlaps or spills at 1440/1100/1024 (verified: zero overlapping pairs and zero spills at all three widths).",
      "Tree of Knowledge re-layout: the planted tree, speech bubble, and the Ask/next-stage/Buy row are all centered on the lawn (measured center 720 in each case), with the action row moved below the lawn instead of floating over it.",
    ],
  },
  {
    id: "records-alignment-charts",
    date: "Oct 5",
    title: "Records alignment and frequency charts",
    tag: "FIXED",
    body:
      "Battle history rows, the Arena win tally, and the Lab " +
      "leaderboard now line up on a fixed grid, and both records " +
      "views gained frequency distribution bar charts.",
    details: [
      "Arena tally: rows center their chip vertically and the win counts sit in fixed-width columns (number right-aligned, suffix left-aligned), so every count and percentage lines up down the board instead of drifting with text width.",
      "Battle history cells are vertically centered against the two-line winner chip, and the Lab leaderboard's champion row no longer shifts 8px right of the other rows.",
      "New FreqBars component (pixel bars with counts and truncated labels) powers three charts: wins by pipeline in the Arena tally, a winner-score histogram in the battle history, and wins by entry in the Lab leaderboard.",
      "Search result rank badges now align exactly with their titles (2px offset removed).",
    ],
  },
  {
    id: "eat-real-sprites",
    date: "Oct 5",
    title: "Eating plays real sprite frames",
    tag: "FIXED",
    body:
      "Eating a paper no longer shuffles the pet through every other " +
      "character's sprite; the pet now plays its own sheet's review " +
      "row — real inspecting frames — and returns to idle.",
  },
  {
    id: "sun-shop",
    date: "Oct 5",
    title: "The Sun Shop and tree wisdom",
    tag: "NEW",
    body:
      "A third Lab tab sells fertilizer for sun earned by playing — " +
      "and every feeding dispenses wisdom: stored garden tips, or a " +
      "typed cheat word at 100, 500, and 1000 feet.",
    details: [
      "Earning runs on real play: +10 sun per daily visit, +1 per 10 pets and per help question (both capped at 5/day), +5 per treasure or achievement, and +2 per five discovered tips (state/sun.tsx).",
      "Fertilizer packs of 1, 5, and 10 cost 20 / 90 / 160 sun (bulk saves 10% and 20%); each packet adds 2 growth points and 30 feet of height to the Tree of Knowledge.",
      "Feeding dispenses stores wisdom, never generated text: a milestone cheat (daisies at 100 ft, dance at 500 ft, pinata at 1000 ft) or the next garden tip in rotation.",
      "Cheat words are armed by typing them in the shop: daisies leaves little daisies when the pet eats a paper, pinata bursts candy instead, and dance makes the pet hop on the spot; arming persists and toggles.",
      "The tree tab shows height beside the stage, and a Buy fertilizer shortcut jumps from the tree to the shop.",
    ],
  },
  {
    id: "tree-of-knowledge",
    date: "Oct 5",
    title: "The Tree of Knowledge",
    tag: "NEW",
    body:
      "The Lab gained a second tab: a Plants-vs-Zombies-style lawn " +
      "where you plant an Oak, Birch, Elm, or Redwood and ask the " +
      "tree for stored system trivia from its speech bubble. LORE " +
      "left the pet — all trivia now lives here.",
    details: [
      "The Lab tab bar separates the recipe bench from the tree; the tree tab renders a seed bank of the four species, a striped lawn grid, and the planted tree with its own speech bubble.",
      "Art pass from pixel-tree references (Tiny Grove, PixelFarm, SLYNYRD's modular bundles): three-tone foliage with dithered edges, redwood conifer tiers, birch hanging leaf clusters, a ground shadow, and a trunk that stretches with the tree's height in feet.",
      "Idle life: the canopy sways from its roots (younger trees more, elder least), a leaf drifts off every few seconds, and sparkles burst when the tree dispenses trivia or fertilizer is planted — all disabled under prefers-reduced-motion.",
      "data/trivia.ts holds the bank: facts about the pipeline math, the walkthrough mechanics, the hunt, and the evaluation harness, each gated behind one of four growth tiers (Seed, Sprout, Sapling, Elder Tree).",
      "Growth counts each treasure, each achievement, and every fourth discovered tip (data/knowledge.ts), shown as the sun counter and the next-stage hint; the species picker changes the silhouette and palette and persists per browser.",
      "Each 'Ask the tree' press gives the next unseen trivia at your stage and remembers it; once a stage is fully learned the tree cycles its set in order, so presses never repeat back-to-back and no sentence is invented.",
      "The pet chat is a pure help library again — the LORE quick question and trivia handout were removed, and the help entry now points at the Lab tab.",
    ],
  },
  {
    id: "help-matcher-words",
    date: "Oct 5",
    title: "Help matcher stops guessing substrings",
    tag: "FIXED",
    body:
      "Keyword matching now compares whole words (plus simple " +
      "plurals), so \"presets\" no longer answers with the RESET tip " +
      "and unrelated questions stop stealing topic entries.",
  },
  {
    id: "search-quality-and-help",
    date: "Oct 5",
    title: "Relevance search, duplicate merge, and a smarter help library",
    tag: "ENHANCED",
    body:
      "Repository search ranks by relevance by default, duplicate " +
      "records are merged, result cards show a signal breakdown, " +
      "and the pet's help library covers the new features.",
    details: [
      "Relevance results carry BM25 snippets with highlighted matches and collapse near-duplicate records behind a +N badge; exact title equality, or 0.85 similarity with a twelve-character floor, keeps garbled titles from merging by accident.",
      "The eight duplicate groups were merged into one master each (published DOI over preprint, PDF over metadata-only), preserving library saves and citation rows; the corpus dropped from 180 to 168 records, and the index was rebuilt.",
      "Search result cards show the weighted TF-IDF / S-BERT / metadata contributions that add up to the score, and the similar-papers graph reports common-reference and common-citer groups from cached OpenAlex links.",
      "The pet chat gained quick questions for ranked search, MMR diversification, duplicate merging, and offline evaluation; its matcher now drops filler words, so 'what is mmr' resolves to the topic entry instead of the generic help answer.",
    ],
  },
  {
    id: "library-batch-export",
    date: "Oct 2",
    title: "Batch export from My Library",
    tag: "NEW",
    body:
      "Tick any papers in My Library and export them together as " +
      "one BibTeX, RIS, EndNote, or Reference Manager file.",
    details: [
      "Selection counts against the live list, so a paper the pet just ate never shows up as selected; Select all toggles the whole library and Clear drops the tick.",
      "papersToCitation joins every record with a blank line — the layout all four formats expect — and downloadCitations saves it as res-search-library-N-papers.ext.",
      "The Export menu mirrors the viewer's dropdown: outside click closes it, and the button stays disabled (with a hint) until at least one row is ticked.",
    ],
  },
  {
    id: "per-form-disposal",
    date: "Oct 2",
    title: "Each character disposes of papers its own way",
    tag: "ENHANCED",
    body:
      "Thrown crumpled papers are no longer destroyed at random: only " +
      "the slime forms eat them, and every other character answers " +
      "with a power from its own role.",
    details: [
      "FORM_DROP_MODES in petlines.ts maps each form to its drop mode: Original and Rimuru eat, Gojo zaps with Cursed Techniques (Blue, Red, Hollow Purple), Glaucira burns with Storm Breath, Crimson Blossom burns with Black Flame, Wangcai zaps with Thunderbolt, Sion, Yinyue Fox, and Kabi crumple, Ciel zaps with Annihilation, and Mashiro Rima punches it flat.",
      "Hover and reaction lines are per form too (FORM_HUNGRY_LINES, FORM_DROP_LINES), so a non-slime pet never says Gimme! or Gluttony! — the slime forms keep the shared gluttonous pools.",
      "The pet body now plays the power animation on a paper drop (it only played for search/upload/delete events before), so the character visibly casts rather than only the paper chip reacting.",
      "App-event reactions (search zaps, uploads eat, deletions burn) keep their shared per-mode pools when the form has no drop line for that mode.",
    ],
  },
  {
    id: "drag-ghost",
    date: "Oct 2",
    title: "Crumpled-paper drag ghost",
    tag: "NEW",
    body:
      "Every library row now drags as a crumpled paper ball instead of " +
      "the browser's default icon.",
    details: [
      "The ghost reuses the pet's own crumple graphic (CrumpledPaper) at a 96x96 data URL, so a dragged paper looks discarded before you drop it on the pet.",
      "Chromium ignores a canvas passed to setDragImage, and ignores an <img> that is not in the document, which is what pushed the drag back to the default icon. MyLibrary now pins a decoded <img> to the DOM at left:-10000px for the duration of the drag and removes it 1000ms after dragstart.",
      "Killed the per-form DRAG_RADII table: ten silhouette variants had to stay in sync with the sprite sheets by hand.",
    ],
  },
  {
    id: "pet-resize",
    date: "Oct 2",
    title: "SIZE slider resizes the sprite",
    tag: "FIXED",
    body:
      "The slider moved an invisible box while the sprite stayed pinned at " +
      "48px. Sprites, shadow, rings, docking, and drag bounds all track " +
      "the real footprint now.",
    details: [
      "PixelPet passed a hardcoded size={48} to PetBlob, so nothing scaled. It now passes petSize, and the sprite holds the sheet's native 192:208 ratio across the whole range.",
      "A stale PET_SIZE = 64 fed the dock clamp, the drag clamp, the tooltip flip, and the speech-bubble flip. A 208px pet could be docked or dragged half off-screen. Replaced with petBox(size) = size * 1.2.",
      "readPetPos clamped saved offsets against the old 64, so a large pet reloaded off-screen. It now takes the size, and the size state initializes before position so the footprint is known on the first read.",
      "handlePetSizeChange re-clamps and persists the position; before, growing the pet while it sat in a corner locked in an offset that no longer fit.",
      "The drop shadow and both rings (hungry + charge) were fixed-pixel SVGs that detached from the sprite. They now scale with petSize.",
      "Verified in Chromium at 48/104/208px: sprite spans 44 to 192px wide, BR and TL docks stay fully onscreen, and position survives reload.",
    ],
  },
  {
    id: "petdex-actions",
    date: "Oct 1",
    title: "The pet walks, waves, and jumps",
    tag: "NEW",
    body:
      "Forms animate from the atlas now: idle, walk, run, jump, and wave, " +
      "each facing the direction the pet last moved.",
    details: [
      "Wave/run/jump read row offsets off the Petdex sheet layout, with a per-sheet run-row fix since the sheets disagree on where their loops start.",
      "The direction derives from the last drag or walk delta, so the sprite faces the side it is leaving from.",
      "Form palettes and per-form talk lines moved into petForms and petlines so the eleven Tempest forms share one data source.",
    ],
  },
  {
    id: "drag-delete-ring",
    date: "Oct 1",
    title: "Drag-delete boundary ring",
    tag: "ENHANCED",
    body:
      "Dragging a paper over the pet lights a translucent, dashed ring " +
      "that marches around it, so the drop zone is obvious while a " +
      "library paper is in flight.",
    details: [
      "The ring is the pet's own footprint, so it widens with the SIZE slider rather than sitting at a fixed radius.",
    ],
  },
  {
    id: "locked-ephemeral",
    date: "Oct 1",
    title: "Locked pet keeps its promise",
    tag: "FIXED",
    body:
      "With the CHAT toggle locked, the pet and logo revert to the " +
      "Original form automatically. Unlock sessions stay ephemeral: " +
      "hovering tips, clicking, asking, and collecting during free " +
      "access never write real progress.",
    details: [
      "Locking restores the exact pre-unlock form and position, so a locked pet cannot end up stuck on a form you never chose.",
    ],
  },
  {
    id: "pipeline-trace",
    date: "Oct 1",
    title: "Pipeline execution trace",
    tag: "NEW",
    body:
      "The engine walkthrough now runs a real search with a recorder " +
      "attached, so the pseudocode next to it fills with that search's " +
      "actual intermediate values.",
    details: [
      "trace_service.py reruns search_papers with a recorder bolted on, capturing the configured weights, the prepared query text, the candidate set, and every component's per-candidate score.",
      "You see the raw TF-IDF and S-BERT cosine similarities, the metadata signal (already 0-1, so it skips normalization), the min-max bounds each component was rescaled against, and the weighted sum S(d) per paper.",
      "Ties print their tie-break by recency, so the final ordering is explained rather than asserted.",
    ],
  },
  {
    id: "independence-weight",
    date: "Oct 1",
    title: "Independence-weighted battle consensus",
    tag: "NEW",
    body:
      "Arena battles no longer treat six pipelines as six independent " +
      "judges. Each vote is weighted by how much evidence the voter " +
      "shares with the pipelines it agrees with.",
    details: [
      "A TF-IDF/SBERT hybrid and its two parent pipelines share most of their evidence, so a plain consensus tally counted one idea three times.",
      "compare_service.py scores each vote by independence(P, Q) = 1 - Jaccard of the two pipelines' component sets. A pipeline voting alongside its own parent carries almost no weight.",
      "Pipelines with no shared components score highest, which makes a clean hybrid-versus-precursor comparison mean something.",
      "Arena shows per-pipeline ranks and average consensus rank next to the winner.",
    ],
  },
  {
    id: "web-battles",
    date: "Oct 1",
    title: "Web battles in the Arena and Lab",
    tag: "NEW",
    body:
      "Arena and Lab gained a Repository/Web scope switcher. Web " +
      "battles vectorize live OpenAlex, Crossref, and arXiv hits with " +
      "the same stored TF-IDF vectorizer and S-BERT model the repository " +
      "search uses.",
    details: [
      "Web hits never touch the battle tally; a web scope compares rankings, it does not award points.",
      "OpenAlex rate-limit retries cap at 8 seconds instead of stalling for minutes.",
      "Web battles embed every hit in one batched S-BERT pass rather than one call per paper.",
    ],
  },
  {
    id: "similar-graph",
    date: "Oct 1",
    title: "Similar-papers graph",
    tag: "NEW",
    body:
      "Each paper grew a Connected-Papers-style graph: weighted edges, " +
      "shortest weighted paths from the origin, and the authors and " +
      "topics the graph shares.",
    details: [
      "connected_graph.py follows the connectedpapers-js model: weighted sparse edges, path_lengths, node_paths, and common_authors/common_topics for anything shared by two or more graph papers.",
      "Edge weight blends the selected pipeline's own components, so the graph cannot contradict the ranking it sits next to.",
      "The reference model derives common references from bibliographic coupling and co-citation. This repo stores no reference lists, so shared keywords and subject/category stand in. That is a deliberate substitution, not a claim of equivalence.",
    ],
  },
  {
    id: "identifier-resolver",
    date: "Oct 1",
    title: "DOI and arXiv resolution",
    tag: "NEW",
    body:
      "Uploads resolve their own identifiers instead of landing unlabeled " +
      "and getting force-fit by the keyword classifier later.",
    details: [
      "identifier_resolver.py handles DOI, arXiv ID, and PDF metadata in one pass, so an import arrives classified rather than empty.",
    ],
  },
  {
    id: "arxiv-taxonomy",
    date: "Oct 1",
    title: "arXiv categories map into the taxonomy",
    tag: "NEW",
    body:
      "arXiv papers carry category codes like cs.LG. Those codes now " +
      "resolve to a real subject and category on import.",
    details: [
      "arxiv_categories.py maps codes onto the repository's taxonomy. A code with no good existing slot creates a new category under the matching subject, following the same taxonomy-grows rule as the classifier's broad fallback.",
      "Unknown codes map to nothing, and the text classifier gets its normal turn.",
    ],
  },
  {
    id: "citation-export",
    date: "Oct 1",
    title: "Citation export",
    tag: "NEW",
    body:
      "Papers export as BibTeX, RIS, EndNote, or RefMan from the " +
      "viewer and the upload flow.",
    details: [
      "exportCitations.ts emits all four formats, with a BibTeX PDF preview on the import side.",
    ],
  },
  {
    id: "hybrid-pipelines",
    date: "Oct 1",
    title: "Six scoring pipelines",
    tag: "NEW",
    body:
      "Search runs through one of six pipelines, from TF-IDF alone to " +
      "the full TF-IDF + S-BERT + metadata blend, with tunable weights.",
    details: [
      "pipeline_config.py defines tfidf, sbert, tfidf_sbert, tfidf_metadata, sbert_metadata, and tfidf_sbert_metadata. The hybrids ship with preset weights (0.50/0.50, 0.667/0.333, and so on) that you can redial in the Lab.",
      "Components are min-max normalized before the weighted sum, except metadata, which is already 0-1. Ranking is S(d) descending, tie-broken by recency.",
    ],
  },
  {
    id: "petdex-sprites",
    date: "Sep 30",
    title: "Real Petdex sprites",
    tag: "NEW",
    body:
      "The pet renders its eleven forms from actual sprite sheets on a " +
      "canvas, with the procedural Original blob kept alongside.",
    details: [
      "idle animation loop, ink outline, and per-form palettes all come off the sheet; Original stays procedural so it can recolor with the theme.",
    ],
  },
  {
    id: "hover-dwell",
    date: "Sep 30",
    title: "Faster tip reveals",
    tag: "ENHANCED",
    body:
      "Hover dwell dropped to 2.5 seconds with a shorter cooldown, so " +
      "tips surface quicker without losing the scavenger-hunt feel.",
  },
  {
    id: "battle-records",
    date: "Sep 29",
    title: "Battle records",
    tag: "ENHANCED",
    body:
      "Arena battle history gained pagination and a win tally, and Lab " +
      "recipes can battle as a custom pipeline with dial weights instead " +
      "of the fixed presets.",
    details: [
      "Pagination and the tally are computed server-side, so the history stays honest as the table grows.",
    ],
  },
  {
    id: "lab",
    date: "Sep 28",
    title: "The Lab opens",
    tag: "NEW",
    body:
      "A recipe workshop: mix TF-IDF, S-BERT, and metadata " +
      "percentages into your own algorithm, simulate battles against " +
      "the six presets, and climb the leaderboard.",
    details: [
      "PipelineDials sets the three weights live; the Lab runs the same search_service path the real API uses, so a recipe that wins here wins in the repository.",
    ],
  },
  {
    id: "typography",
    date: "Sep 28",
    title: "Typographic tune-up",
    tag: "ENHANCED",
    body:
      "Pixelify Sans standardized across the interface, with a prose " +
      "pass over every label and message.",
    details: [
      "Also killed the ticker text overflow that let long messages smear past their track.",
    ],
  },
];
