# Recorded combat audio in world-editor.html

Starting in v132, the game uses the two *B* edits selected in the Foley audition. v133 remasters the same CC0 recordings, aligning the two wood transients and layering more recorded flecks into the wet tail. v134 emphasizes the single wooden crack and extends the burst with irregular recorded drops landing through the tail. Each edit is assembled from recordings individually marked [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) on its Freesound source page. These are sound effects created from recordings of objects and materials, not sampled from a commercial game.

| Game cue | Source recordings |
|---|---|
| Wooden sword contact (B) | [Wood Knock by Mrguff](https://freesound.org/people/Mrguff/sounds/369710/) and [Door Knock Angry by Julibellule](https://freesound.org/people/Julibellule/sounds/657774/) |
| Enemy defeat (B) | [Slime slapping by greenlinker](https://freesound.org/people/greenlinker/sounds/794272/), [squelching.mp3 by tiddles451](https://freesound.org/people/tiddles451/sounds/547446/), and [Gelatinous Cube Approach by e_r_r_1012](https://freesound.org/people/e_r_r_1012/sounds/837146/) |

The prepared mono edits were trimmed, filtered and layered. The HTML holds the current edits’ exact 24 kHz mono signed 16-bit little-endian PCM samples (WAV container headers are not needed by the player). They are cached at first use and played through the existing effects controls. No audio file request is made; the installed Android player updates and serves only this HTML.

| Cue | Frames | PCM SHA-256 |
|---|---:|---|
| Wood | 6048 | `dbde51a5692c23eed2e7a5f65e0482457c4e9bb509180a71e6ec3f003b182012` |
| Defeat | 20808 | `7fe72efca8e582c4798277937006cbb5107e933bf7d27b848f727e2cbeb52587` |
