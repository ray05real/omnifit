# Omniload — project brief

Read this first in every session. Omniload is a separate app from Pollz (which lives in
`Documents/pollz-starter`): don't mix the two projects' code, data or plans.

**The app is called Omniload** (the owner's pick, 14 Nov 2026: "Omnifit" was already taken on the App Store;
Omniload = the "omni" of the old name + progressive overload; no app with that name showed in the UK / US App
Store search, but only App Store Connect can confirm it is free). The folder, the GitHub repository
(`ray05real/omnifit`), the app identifier (`com.omnifit.app`, kept so installing over the old app keeps its data)
and the storage keys still say "omnifit": leave them.
**Logo:** an "O" that is also a weight plate and a ring filling up, white on black with the last stretch green
(`node scripts/make-icon.js` redraws `assets/icon.png` and friends; no design tool needed).

## Who you are working with
- The owner has **no coding experience**. Explain each step in plain English, one step at a time.
  Tell them exactly what to click or type, and what they should see when it worked.
- They use a **Windows PC** and an **iPhone**. Test on the iPhone through the **Expo Go** app (scan the QR code from
  `npx.cmd expo start --max-workers 2`; phone and PC on the same Wi-Fi; logged in to the same Expo account on both).
  In commands the owner types use `npx.cmd` / `npm.cmd` (PowerShell blocks the plain ones), and keep
  `--max-workers 2` (the PC is short of memory).
- Save to GitHub after every step that works, with a plain-English message, so any version can be brought back.
- Keep costs near zero: free tiers first. Say clearly before anything would cost money.
- After each milestone, ask them to test on the phone and report what's wrong before moving on.

## What Omniload is (the owner's brief, 11 Nov 2026)
A personal gym companion for the owner (a bodybuilder / regular gym goer), built on the three things that
matter: **progressive overload, nutrition and sleep**. Overload and nutrition are the focus (they are the most
controllable); sleep and body weight are simple manual logs. **Keep everything simple**: the owner said so
several times, above all for Overload.

**Five sections, in this order, and you swipe left / right between them** (a tab bar at the bottom too):
Overload · Nutrition · Weight · Sleep · Metrics.

### 1. Overload (must stay simple)
- The owner logs training in the Notes app today: the training programme, each session's exercises, and under
  each exercise its sets with the weight and reps done. They like that format; what's tedious is retyping the
  numbers. (They said they'd send a screenshot of their notes: match its layout when it arrives.)
- The first screen shows **the split**: the sessions (e.g. Push day). Tap one to see and log that workout,
  which is set up in advance.
- Under each exercise: its sets, each "weight × reps". **Tap a set's numbers and a scroll wheel appears**
  (kg, a quarter-kg wheel, reps); "Log set" saves it as done today. The circle on the right ticks a set done
  with the same numbers as last time. The numbers always show the last ones done, like the notes.
- **Exercises can't be changed unless you tap Edit**, which makes everything editable (session name, exercise
  names, order, sets, starting numbers; delete). No exercise catalogue: the owner types their own.
- Each logged set remembers what it was last time, so a set is up (more weight or reps), the same or down.
  If weight and reps moved in opposite directions, the estimated one-rep max (weight × (1 + reps / 30)) decides.

### 2. Nutrition (MacroFactor as the inspiration, not a copy)
- The owner sets a daily **calorie goal and macro goals** (protein, carbs, fat) themselves.
- Each day: log foods and drinks **with the time** (a timeline, as in MacroFactor), a big **ring that completes
  when the calorie goal is reached** with the numbers inside, and smaller rings for the three macros.
- **My foods**: the owner's own catalogue, added by hand (name, per 100 g / 100 ml / 1 serving, kcal, protein,
  carbs, fat) and reused; most recently used first. **Quick add** for a one-off (just calories and macros), with
  an option to keep it in My foods.
- An online food catalogue was "not that effective" in MacroFactor for the owner. They asked for it only if it's
  simple: **planned as the next step** with Open Food Facts (free; search by name and barcode scan), after the
  core is tested. Not built yet.
- (How MacroFactor does it, looked up 11 Nov 2026: food goes on an hourly timeline at the current hour by
  default; custom foods are reusable, Quick Add entries aren't; a met target is highlighted; its targets come
  from an expenditure algorithm and weekly check-ins, which Omnifit does not copy: goals are typed in.)

### 3. Weight and 4. Sleep (simple manual logs)
- Weight: one entry per day (wheel: kg and tenths), the change since the last one, history; any past day can be
  filled in or corrected.
- Sleep: hours and minutes per night (wheel), a sleep goal (8 h to start), history; same back-filling.

### 5. Metrics
- **A calendar** that switches between Overload, Nutrition, Weight and Sleep, **colour coded instead of text**:
  - Overload: a gym day is filled in: green = went up, amber = the same, red = went down (more sets up than
    down = up, and so on), the section's orange = logged with nothing to compare yet; an empty day = no gym.
  - Nutrition: a ring round the date that fills with the day's calories: green when the goal is reached (95% to
    110% of it), amber part-ring when under, red when over; a small dot when the protein goal was met.
  - Weight: the day's weight in the cell. Sleep: the hours, green at the goal, amber within an hour, red below.
  - Tap a day for its details underneath.
- **A graph mode** for the same four: the change over time (1M / 3M / 6M / 1Y / All). Overload: pick an exercise,
  see its top weight or its strength (est. one-rep max). Nutrition: calories against the goal. Weight: the
  entries plus a smoothed trend line. Sleep: hours against the goal.

## Decisions so far (change them if the owner says so)
- Units: kg, kcal, grams. Week starts on Monday.
- **Everything is stored on the phone** (no account, no server, no cost). In Expo Go the data lives inside Expo
  Go; before the owner relies on it daily, give it a backup / export and install it as its own app (a
  development build needs the Apple Developer account, £79/yr; the owner's To Do app was sideloaded instead:
  ask which they prefer).
- **Colours (the owner, 11 Nov 2026: "too many colours, stick to a palette", look at MacroFactor): black,
  white and greys only; green = good (went up, goal reached), grey = the same / not there yet, red = went down /
  too much. No colour per section, no colour per macro.** (The section colours below are retired.)
  **One exception (the owner, 14 Nov 2026, "test the colour theory"): the soft glow at the top of each page is
  coloured:** Overload purple, Nutrition green, Weight yellow, Sleep blue (purple and blue kept well apart),
  Metrics grey and quieter. Nothing else takes the section's colour.
- **Look: like one of Apple's own iPhone apps (the owner, 11 Nov 2026: "imagine Apple added these features to
  their own apps").** Apple's dark-mode system colours (black background, `#1C1C1E` cards with a faint glass
  edge, a soft glow of the section's colour at the top of each page); one colour per section (Overload
  systemOrange, Nutrition systemGreen, Weight systemBlue, Sleep systemIndigo); protein purple, carbs cyan, fat
  yellow; up green / same yellow / down red. Large titles, San Francisco, rounded continuous corners, grouped
  lists (Settings style), capsule buttons, Apple's segmented control. **Glass** (Liquid Glass on iOS 26, a blur
  elsewhere; `src/components/Glass.tsx`) for what floats: the tab bar (a floating capsule like Instagram's, the
  current section in a lighter pill that follows the finger while swiping), the round buttons, the Edit button.
  Sheets float with big rounded corners (iOS 26). Rings as Apple's Activity rings (dimmed own-colour track).
  The Metrics calendar is Apple's Calendar month view (month name big, year red, hairlines between weeks, today
  red, the chosen day in a white circle) with our marks under each date. Graphs as Apple Health (scale on the
  right, dashed grid). **Overload sessions look like the owner's Notes** (their screenshot): each exercise its own
  paragraph (card), each set a plain line "50kg – 10", minimal. All tokens in `src/theme.ts`.

- **Overload details (the owner, 14 Nov 2026):** press and hold a session in the split, then **drag** it to
  reorder (`src/components/DragList.tsx`; arrows were tried and rejected). In a session the **weight and the
  reps are two separate things to tap**, each opening its own wheel. **No card behind an exercise** (the owner:
  it "feels AI generated"): plain paragraphs with one very thin line between exercises, compact, with the
  proportions of the owner's Notes page (17pt text, lines about 30pt apart).
- **More Overload (the owner, 14 Nov 2026):** exercises inside a session reorder the same way as sessions
  (press and hold anywhere on the exercise that isn't a button, then drag; in Edit a ≡ handle shows where).
  It doesn't auto-scroll yet while dragging past the edge of the screen. **Swipe right inside a session goes
  back to the split** (the pager is pulled past its left edge; `backSwipe` in `src/store/pageLock.ts`). **Cardio** can be added next to
  exercises (Edit → "+ Cardio"): a name (Bike, Rower…) and lines of **time – watts** ("20min – 150W"); the
  second number can be switched in Edit to km, kcal or level. Same wheels, ticks and up / same / down
  (more time or more watts = up; if they go opposite ways, minutes × watts decides).
- **Round + button, bottom right** (the owner, 14 Nov 2026) on Nutrition, Weight and Sleep instead of the wide
  button, to leave room for the lists. **Nutrition's card (the owner's final word, 14 Nov 2026):** the card
  carries the date (no separate date bar): swipe the card sideways, or tap its small arrows, to change day; tap
  the date to come back to today. Inside, everything is **full size** (210 calorie ring, 66 macro rings; a
  shrunk version "looked too small") with the three macro rings **stacked to the right of the calorie ring**.
  **Tapping a logged food edits all of it in one place** (name, amount, calories, macros, time; delete).
- **Testing is by sideloaded .ipa now** (the owner, 14 Nov 2026), same as the To Do app: every push to GitHub
  builds unsigned .ipa files on GitHub's Macs (`.github/workflows/build.yml`) and publishes them as a Release;
  the owner signs them in Kravasigner. The repository is public for that (free Mac builds, direct links).
- **Two versions, always built together from the same code (the owner, 14 Nov 2026):**
  - **Standard** (`Omniload.ipa`): weight logged by hand, **no Bluetooth at all** (the library isn't even linked).
    This is the one for other people and, one day, the App Store.
    https://github.com/ray05real/omnifit/releases/latest/download/Omniload.ipa
  - **With scale** (`Omniload-Scale.ipa`): the owner's own, adds "Weigh with my scale" on the Weight page for
    their **Renpho ES-28ML** (ES-30M hardware, the "QN" family).
    https://github.com/ray05real/omnifit/releases/latest/download/Omniload-Scale.ipa
  The build number is written into `variant.json` too and shown under the split on the Overload page
  ("Omniload · build 6"), so the owner can tell which build is installed; new builds are listed at
  https://github.com/ray05real/omnifit/releases.
  `variant.json` (`{"scale": false}` in the repository; the build writes `true` for the scale version) is read by
  `app.config.js` (Bluetooth permission + plugin), `react-native.config.js` (leaves the library out) and the
  Weight page. Same app name and identifier, so either installs over the other and keeps the data.
- **The scale (not yet confirmed working on the owner's phone):** Renpho publishes nothing; the messages come
  from openScale's notes on the QN / ES-30M scales. `src/lib/qnScale.ts` is the conversation (tested against
  openScale's sample messages), `src/scale/scale.ts` the Bluetooth part (react-native-ble-plx),
  `src/screens/ScaleSheet.tsx` the sheet. It can only be tried with the owner's scale: the sheet has **"Send a
  report"** (everything seen and said); ask the owner to paste it when it fails, and fix from that.

## Tech
- **Expo SDK 58** (the version the App Store's Expo Go runs; re-check before upgrading), React Native,
  TypeScript. No router: one screen with a horizontal pager for the five tabs (`App.tsx`), sheets as modals.
- Data: zustand stores saved with AsyncStorage (`src/store`), one per area (training, nutrition, body).
- Logic with no drawing in `src/lib` (dates, set comparison, day status, totals), with tests
  (`npm.cmd test`, Node's own test runner).
- Wheel: `@react-native-picker/picker` (the real iOS wheel; a drop-down in the PC's web preview).
  Rings, calendar marks and graphs drawn with `react-native-svg`.
- Preview on the PC: `.claude/launch.json` → "omnifit-web".

## Plan
1. **First version (built 11 Nov 2026):** the five swipeable tabs; Overload with the wheel and Edit mode;
   Nutrition with goals, rings, timeline, My foods and Quick add; Weight; Sleep; Metrics calendar and graphs.
   → The owner tests on the iPhone and says what's wrong.
2. Fixes from that test; match the owner's notes screenshot in Overload.
3. Online food catalogue (Open Food Facts search, then barcode scan) if the owner still wants it.
4. Backup / export of the data; then install as its own app on the iPhone.
5. Later ideas (only if asked): helper that suggests calorie goals from the owner's metrics, rest timer,
   notes per exercise, Apple Health for sleep and weight.
