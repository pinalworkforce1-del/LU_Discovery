# Northern BOOST résumé builder → Level Up (direct-copy migration)

## Baseline
This folder is a literal, isolated copy of the working Northern BOOST staged Ready 2 Work résumé builder, not a rewritten Level Up adapter. The original `app.js`, `index.html`, polish, occupation search, evidence review, strategy and formatting scripts are preserved byte-for-byte at this baseline commit. Supporting styles, full O*NET catalog, and course data are copied locally for reproducibility.

Source: `pinalworkforce1-del/Northern-BOOST/site/preview-v2/ready2work/` on main.

## Important: not yet an executable Level Up preview
The copied `index.html` still has Northern BOOST's session guard and the original `app.js` still points to Northern-specific save/AI endpoints. It must **not** be published or linked as a Level Up participant environment until those connections have been replaced, real authentication and persistence are tested, and the separate route passes browser regression testing.

## Narrow adapter boundary
1. **Brand/auth:** Use Nova and the Level Up Supabase authenticated participant session. No Northern auth or enrollment checks.
2. **Storage:** Scope the original builder's saved state per Level Up authenticated user; load/save its unchanged résumé data structure to a distinct nested field in `resume_profiles.master_data`. Never overwrite prior résumé versions or legacy profile content.
3. **AI:** Adapt the Northern résumé AI request/response at the single existing `callR2WResumeAI()` function. Preserve the original staged coaching UX, including follow-up questions, draft selection, and review.
4. **Completion:** Create a canonical `resume_versions` record and return to Level Up Ready 2 Work or Resume District. Expo sharing is a **separate explicit finalization**, not an automatic consequence of selecting a bullet.
5. **Regression tests:** Cover draft selection, selected-state appearance, one-bullet addition, no duplicate additions, cloud restore after refresh, existing-version preservation, and progression. Test on a separate GitHub Pages route before changing any existing Level Up link.

Do not merge the older `northern-resume-builder-port-20261111` controller into this direct-copy implementation. Its reconstructed interactions caused regressions, and it is no longer the migration baseline.
