# Recorded combat audio in world-editor.html

Starting in v132, the game uses the two *B* edits selected in the Foley audition. v133 remasters the same CC0 recordings, aligning the two wood transients and layering more recorded flecks into the wet tail. v134 emphasizes the single wooden crack and extends the burst with irregular recorded drops landing through the tail. v135 keeps that wood contact and replaces the splash with one common defeat cue: snapped fibres, a dry tear and a compact low thud. Each edit is assembled from recordings individually marked [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) on its Freesound source page. These are sound effects created from recordings of objects and materials, not sampled from a commercial game.

| Game cue | Source recordings |
|---|---|
| Wooden sword contact (B) | [Wood Knock by Mrguff](https://freesound.org/people/Mrguff/sounds/369710/) and [Door Knock Angry by Julibellule](https://freesound.org/people/Julibellule/sounds/657774/) |
| Common enemy defeat (v135) | [Celery Snap by saturdaysoundguy](https://freesound.org/people/saturdaysoundguy/sounds/388019/), [celery crunching by breadparticles](https://freesound.org/people/breadparticles/sounds/584395/), and a low, filtered part of [Door Knock Angry by Julibellule](https://freesound.org/people/Julibellule/sounds/657774/) |

The prepared mono edits were trimmed, filtered and layered. The HTML holds the current edits’ exact 24 kHz mono signed 16-bit little-endian PCM samples (WAV container headers are not needed by the player). They are cached at first use and played through the existing effects controls. No audio file request is made; the installed Android player updates and serves only this HTML.

| Cue | Frames | PCM SHA-256 |
|---|---:|---|
| Wood | 6048 | `dbde51a5692c23eed2e7a5f65e0482457c4e9bb509180a71e6ec3f003b182012` |
| Defeat | 15264 | `60149cfd167a33f946065b7cbd3186e8d710b4658d2afabfba0e29c7c285d09a` |
