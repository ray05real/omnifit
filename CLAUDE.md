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
  It doesn't auto-scroll yet while dragging past the edge of the screen. **Cardio** can be added next to
  exercises (Edit → "+ Cardio"): a name (Bike, Rower…) and lines of **time – watts** ("20min – 150W"); the
  second number can be switched in Edit to km, kcal or level. Same wheels, ticks and up / same / down
  (more time or more watts = up; if they go opposite ways, minutes × watts decides).
  **Distance (the owner, 18 Nov 2026):** a cardio line has a third number, the km ("60min – 150W – 25km"), with
  its own wheel (km and tenths); hidden when the second number is already km. It counts in up / same / down only
  when both times have a distance. Metrics has a "Distance" graph for it. Stored as `SetVal.dist`.
- **Exercise options (the owner, 16 Nov 2026):** an exercise can have other versions of itself (e.g. "Preacher
  curl" / "Single-arm preacher curl"), **each with its own weights and reps**. **No presets or catalogue: the owner
  types each option's name, and a new option starts with empty numbers.** In Edit, chips under the exercise's
  name: tap one to show and fill it in (the name box and sets are that option's), × removes one that isn't
  showing, "+ Add an option" adds one. In the session, an exercise with options shows a small ⇄ badge next to its
  name: **tap the name to swap** (a sheet lists each option with its last numbers and what's done today), even
  halfway through: sets already ticked stay logged under the option they were done with, and "Done today: 1 set
  of Preacher curl" shows under the name. Each option logs under its own id, so it has its own history and graph in
  Metrics. Model: `Exercise.vid` (the option showing), `alts` (the others), `order`; helpers `optionId`,
  `optionsOf` in `src/store/training.ts`. Cardio exercises can have options too (bike / rower); they share the
  exercise's kind and metric.
- **Round + button, bottom right** (the owner, 14 Nov 2026) on Nutrition, Weight and Sleep instead of the wide
  button, to leave room for the lists. **Nutrition's card is compact and carries the date**: swipe the card
  sideways (or tap its small arrows) to change day, tap the date to come back to today; no separate date bar.
  **Tapping a logged food edits all of it in one place** (name, amount, calories, macros, time; delete).
- **The owner went back to build 6 on 16 Nov 2026** (two later Nutrition layouts and swipe-right-to-go-back in a
  session were reverted; don't bring them back unasked).
- **Scan the pack (the owner, 16 Nov 2026).** In the new-food form, **two separate buttons: "Barcode" and
  "Nutrition table"** (the standard version shows only the nutrition table). Each opens a **live camera like an
  ID check** (`src/scan/ScanCamera.tsx`): a box to line the pack up in, **grey while it works, green when it
  can read it**, and a line under it saying what's happening ("Point the camera at…", "Move closer so the table
  fills the box", "Hold steady… focusing", "Ready: tap the button"). The numbers are filled into the form, to be
  checked before saving. **The owner's rule: no AI service, no data collection, everything on the phone.**
  - **Nutrition table (both versions), read on the phone:** every second or so a frame is taken silently,
    shrunk and read by `modules/label-reader` (a tiny local Expo module in Swift: Apple's Vision, text with
    positions); `src/lib/label.ts` finds each nutrient's name, the numbers level with it to its right (tolerant
    of a slight tilt and tight rows), the "per 100 g" column by its heading, fixes common misreads (O for 0,
    "g" read as 9), and `combineReadings` keeps what most frames agree on. **Green = two frames agree on
    protein, carbs and fat.** The button then takes a sharp photo, which counts double. Nothing leaves the phone.
  - **Barcode (only the owner's version, `variant.json` "scale": true):** the camera spots the barcode by
    itself (check digit verified), then looks it up in Open Food Facts (free, no account; only the barcode's
    digits are sent), which also gives the name and the pack size. If it isn't there: "Scan the nutrition table
    instead". **The standard version must never make a network request**: `lookUpBarcode` in `src/scan/scan.ts`
    returns nothing unless `barcodeLookup`.
  - **"Half a pack":** a food can have a whole-pack size (typed, or from the barcode); logging it then offers
    ¼ pack / ½ pack / Whole pack next to typing the grams.
  - The first version (one button, a single photo) "only picked up some numbers" on the owner's phone (16 Nov);
    this live version is not yet confirmed there.
- **Dishes (the owner, 18 Nov 2026: "scanning each ingredient clogs up my food log"; keep it simple).** In Log
  food, next to "New food", a **"New dish"** button (`src/screens/DishForm.tsx`): one page with the dish's name,
  "What went into it" (each ingredient with how much went in and its kcal; tap one to change or remove it),
  "+ Add ingredient" and the whole dish's totals. **"+ Add ingredient" offers the usual ways:** scan its barcode
  (the owner's version only), scan its nutrition table, pick it from My foods, or type the numbers; all end in the
  same small form (check the numbers, "How much went in", with ¼ / ½ / whole pack when the pack size is known).
  **The ingredients live inside the dish, not in My foods.** The dish is saved in My foods as one food (unit
  'serving', 1 = the whole dish; "Dish · 3 ingredients" under its name; the edit button reopens the dish). Logging
  it offers **Whole / ½ / ⅓ / ¼** (or a typed part) and the day's log gets **one line**, e.g. "½ dish".
  Model: `Food.ingredients`, `Ingredient`, `dishTotals`, `dishPart`, `FoodEntry.dish` in `src/lib/nutrition.ts`.
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
3. Scan the pack (label on the phone; barcode lookup in the owner's version only): built 16 Nov 2026, to be tested.
4. Backup / export of the data; then install as its own app on the iPhone.
5. Later ideas (only if asked): helper that suggests calorie goals from the owner's metrics, rest timer,
   notes per exercise, Apple Health for sleep and weight.
