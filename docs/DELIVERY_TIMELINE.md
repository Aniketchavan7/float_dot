# Remaining delivery timeline

Planning baseline: 9 October 2026. M00/M01 are implemented; M02/M03/M04 have automated checks with physical release gates open. These are estimates, not promised completion dates.

Assume 25–30 focused hours per week on the existing Windows desktop scope, timely tester/provider-account access, and no framework rewrite. Person-days below mean roughly six focused engineering hours. They include verification and some defect fixing, not only code generation.

| Remaining work | Budget | Order / parallel work |
| --- | --- | --- |
| M04 real-mic validation and fixes; M02/M03 hardware checks | 2–4 working days | Start now; hardware sessions can run alongside provider work |
| M06 provider capabilities, setup/error handling and live matrix | 3–5 days | Next implementation module; stabilizes configurations for quality evaluation |
| M05 prompt/context quality and held-out evaluation | 5–8 days for one cycle | After provider configuration is stable; budget another cycle if accuracy fails |
| M07 onboarding/settings | 2–4 days | Aniket can build independently while M05/M06 proceed |
| M08 hardening and performance | 3–5 days | Final integration plus two-hour soak and failure/recovery checks |
| M09 installer, CI, assets and clean-machine validation | 4–6 days | CI/metadata can start earlier; release candidate follows hardening |
| M10 pilot, support and launch decision | 3–5 active days plus at least seven calendar days of pilot use | Five testers; fixes may extend the pilot |

Total baseline is roughly 22–37 focused person-days (132–222 hours), plus elapsed pilot time. Some activities overlap, especially hardware checks, onboarding and early CI work.

## Calendar targets

- **Pilot-ready build: approximately 4–6 weeks**, around **6–20 November 2026**, assuming steady progress and independent onboarding/testing support. This targets a build ready for invited testers, not public release.
- **Public release: approximately 6–9 weeks**, around **20 November–11 December 2026**, after pilot feedback, clean-install checks and release gates pass.
- At 10–15 hours/week, budget roughly twice the calendar time. Extra prompt-quality cycles, missing live accounts, signing setup or display/device defects can extend these ranges.

## Next steps

1. Finish the physical M04 checklist and M02/M03 mixed-display checks; log failures with exact devices/scales.
2. Implement M06 capabilities and provider recovery, then freeze tested provider/model configurations for M05 evaluation.
3. Build M07 onboarding independently; integrate its optional asset install experience with M09.
4. Run M08/M09 gates, invite pilot testers, then decide release scope based on observed quality and repeat use.

Keep meetings experimental until their additional tests pass. Defer continuous listening, system-call audio, browser extensions, accounts, billing and team features so they do not delay the core desktop release.
