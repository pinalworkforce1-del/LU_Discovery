# Nova résumé builder — Northern source extraction

Source: `pinalworkforce1-del/Northern-BOOST/site/preview-v2/ready2work/` (main).

This directory contains **unmodified reference modules** from Northern BOOST. They are not loaded by Level Up production.

## Integration boundary

- Port only the four-stage résumé builder: Studio setup, Experience discovery, Skills/education/target, Format/build/verify.
- Do not port scenario content, course maps, certificates, Northern guard, or Northern enrollment/progression state.
- Replace Northern-specific localStorage key `boost-northern-r2w-v1`, Supabase project, and AI endpoint before any module is activated.
- Preserve Level Up authentication and existing `resume_profiles`/`resume_versions` data, including finalized Expo versions and the Ready 2 Work completion contract.
- Rename user-facing Rosie guidance to Nova, but do not globally replace identifiers or modify backend endpoints without compatibility checks.
- Do not treat the source files as a functional standalone app: the Northern `app.js` owns their state, rendering, and event bindings.

## Release gate

Build a standalone Level Up adapter for the Northern builder UI, verify all four stages, AI evidence review, résumé format and PDF, cross-session persistence, Expo versioning, and Ready 2 Work return; only then replace the old entry point.
