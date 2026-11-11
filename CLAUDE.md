# Omnifit — project brief

Read this first in every session. Omnifit is a separate app from Pollz (which lives in
`Documents/pollz-starter`): don't mix the two projects' code, data or plans.

"Omnifit" is a working name for now.

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

## What Omnifit is (the owner's brief, 11 Nov 2026)
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
