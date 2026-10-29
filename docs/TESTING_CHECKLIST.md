# EduConnect - Testing Checklist

Tester: `[Student Name]` &nbsp; Date: `[Date]` &nbsp; Browser/version: `[e.g. Chrome 130]`
Mark each item `[x]` when it passes. Automated tests: `node tests/run-tests.js` (19), `python3 tests/test_schema.py` (5), `python3 tests/check_consistency.py`.

## A. Automated (run first)
- [ ] `node tests/run-tests.js` prints `19/19 tests passed`
- [ ] `python3 tests/test_schema.py` prints `5/5 schema checks passed`
- [ ] `python3 tests/check_consistency.py` prints no `FAIL`

## B. Manual - Requirement input (FR3)
- [ ] **TC01** Choose no subject, press *Find tutors* -> inline error, no results
- [ ] **TC01b** Budget `-5` or `0` -> error; budget `20000` -> "unrealistic" error
- [ ] **TC02** Window start 20:00, end 18:00 -> validation error; only one time filled -> error
- [ ] Leave days empty and window empty -> search still works

## C. Manual - Matching and explanations (FR4, FR5)
- [ ] **TC03** Click *Load demo scenario* -> exactly 3 tutors (Rahim Uddin, Tasnim Karim, Farzana Akter); Rahim first with score 93
- [ ] **TC04** Scores are descending and between 0 and 100
- [ ] **TC05** Open *Why this score?* -> 6 factors; points add up to the displayed score
- [ ] **TC07** Open *Matching priorities*, set all sliders to 0 -> error message, ranking unchanged
- [ ] **TC07b** Set Budget to 50 and the others to 0 -> ranking changes (cheapest tutor first)
- [ ] Choose *Physics I* -> only tutors teaching Physics I appear
- [ ] Mode *In-person* with an online-only tutor -> that tutor's mode factor shows 0%

## D. Manual - Availability (FR6)
- [ ] **TC06** Demo scenario: Tasnim and Farzana show availability fit 0% (no free slot on Sat/Mon)
- [ ] Slots inside the window are highlighted green; other free slots are plain; booked slots are struck through and not clickable

## E. Manual - Booking and conflicts (FR7, FR8)
- [ ] **TC08** As Nusrat, book Rahim Sat 18:00-20:00 -> toast "Booking B002 created (Pending)"; slot becomes booked
- [ ] **TC09** Switch to *Tanvir Hossain*, run the same search, try the same slot -> it is disabled; (if forced) rejected as taken
- [ ] **TC10** As Nusrat: search *Digital Logic Design* and book Arif Chowdhury Mon 16:00-18:00; then search *English Composition* and try Shirin Sultana Mon 17:00-19:00 -> rejected, message mentions overlap
- [ ] **TC11** Tutor not teaching the subject cannot be booked (covered by unit test)
- [ ] **TC12** Reload the page -> bookings and blocked slots persist

## F. Manual - Status display (FR9, FR10)
- [ ] **TC13** Pending booking: *Tutor accepts* -> Confirmed; *Mark completed* -> Completed; no further actions
- [ ] **TC14** *Cancel* on Pending/Confirmed -> Cancelled and the slot can be booked again
- [ ] Seeded booking B001 (Tanvir, Farzana, Sun 16:00-18:00) shows as Confirmed for Tanvir only
- [ ] *Reset demo data* restores only B001

## G. Non-functional
- [ ] **TC15** Width 360 px (browser dev tools): no horizontal page scrolling; tables scroll inside their box
- [ ] Keyboard only: Tab reaches all inputs/buttons; Enter submits; dialog closes with Esc
- [ ] Text contrast is readable; every input has a visible label
- [ ] Works in latest Chrome, Firefox and Edge (note any differences): `________`
- [ ] Opening `index.html` directly from disk works without a server

## H. Deliverables check
- [ ] Proposal compiles in Overleaf (pdfLaTeX + BibTeX) with no errors
- [ ] All red `[placeholders]` replaced (`grep -rn "\[Student" .`)
- [ ] Six diagrams present in `diagrams/png` and sources in `diagrams/source`
- [ ] README setup instructions work on a clean clone

## Defect log
| ID | Description | Severity | Status |
|----|-------------|----------|--------|
|    |             |          |        |
