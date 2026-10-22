# Stakeholder demo (PRD §19), about 5 minutes

Uses the bundled sample pair: a generated Arnifi-style homepage and a "developed" version with six intentional differences. Say clearly that it is sample data. The comparison is real.

**Before you start:**
- Run `npm run build && npm start` (or `npm run dev`).
- Open http://localhost:3108 in Chrome at 1440 px or wider.
- If earlier runs are listed under Recent comparisons, delete them for a clean story.

## 1. Beginning (30 s)

> "This is a Figma design that our team has approved, and this is the page developed from it."

- Click **Try With Sample Screenshots**. Both cards show the preview, the file name and **1440 × 3083 px**, with a *Sample data* badge.
- Optional: point at the drop zone. In real use you export the Figma frame at 1x, or *Copy as PNG* and paste.

## 2. Problem (30 s)

> "Today, we manually compare both screens, identify differences, document bugs in a spreadsheet, and chase fixes. One page can have 40–50 of these."

## 3. Demonstration (3 min)

> "We upload the two screenshots and run a comparison."

1. Click **Run Comparison**. The stepper runs: reading, normalising, comparing, grouping, preparing. It finishes in well under a second, and nothing leaves the browser (point at *Processed in this browser*).
2. In the workspace:
   - **Summary strip:** 0.69% of pixels differ. This is an image statistic, not a quality score. Point out the 7 potential regions.
   - **Side by side:** the red dashed boxes are *potential* differences, not bugs yet.
3. Click **R1** in the sidebar. Both screenshots zoom to the header CTA, and the crops show the off-token blue.
   > "We can now inspect those differences, confirm which ones are actual bugs…"
   - Rename it to "Header CTA uses #3939CC instead of brand blue" and click **Confirm Bug**. It becomes **BUG-1**, and the next difference opens automatically.
4. **R2** (navigation spacing): confirm it.
5. **R3** (hero heading):
   - Switch to **Overlay**, drag the opacity slider and tick *Difference blend*. The smaller heading shows clearly.
   - Then switch to **Difference Mask**. Confirm the issue.
6. Dismiss one region to show that dismissed items stay visible but never reach the bug list (**Undo** is available).
7. Optional: press `J`/`C`/`D` to show keyboard review.

> "…and create a structured issue list."

8. Click **Design Issues**. Only the confirmed bugs are listed.
   - Set BUG-1's severity to **High**.
   - Move its status from **Open** to **In Progress**, then to **Fixed**.
   - Point out that **Verified** only appears once it is Fixed: a designer checks the fix before it counts.
9. Click **Export CSV** and open it to show project, ID, title, description, severity, status, region and date.

## 4. Outcome (30 s)

> "This gives designers, developers and PMs a shared place to identify and track design inconsistencies, reducing repetitive QA work."

**Don'ts:**
- Don't claim a percentage time saving. It hasn't been measured.
- Don't describe the results as AI. The MVP is deterministic pixel comparison.
- If asked about exact font sizes, say the tool shows *where* things differ, and the values are checked in Figma.

## Backup states worth showing if asked

- **Identical screenshots:** upload `public/samples/arnifi-home-design.png` twice. The result is "No meaningful visual differences detected." with no cards.
- **Mismatched sizes:** use `tests/fixtures/mismatch-1440x900.png` as the website screenshot. The app explains the mismatch and won't run.
- **Misaligned capture:** use `tests/fixtures/build-shifted.png`. It warns that everything moved about 12 px and holds back the regions.
