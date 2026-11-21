# Recorded combat audio in world-editor.html

v132 uses the two *B* edits selected in the Foley audition. Each edit is assembled from recordings individually marked [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) on its Freesound source page. These are sound effects created from recordings of objects and materials, not sampled from a commercial game.

| Game cue | Source recordings |
|---|---|
| Wooden sword contact (B) | [Wood Knock by Mrguff](https://freesound.org/people/Mrguff/sounds/369710/) and [Door Knock Angry by Julibellule](https://freesound.org/people/Julibellule/sounds/657774/) |
| Enemy defeat (B) | [Slime slapping by greenlinker](https://freesound.org/people/greenlinker/sounds/794272/), [squelching.mp3 by tiddles451](https://freesound.org/people/tiddles451/sounds/547446/), and [Gelatinous Cube Approach by e_r_r_1012](https://freesound.org/people/e_r_r_1012/sounds/837146/) |

The prepared mono edits were trimmed, filtered and layered. The HTML holds the audition candidates’ exact 24 kHz mono signed 16-bit little-endian PCM samples (WAV container headers are not needed by the player). They are cached at first use and played through the existing effects controls. No audio file request is made; the installed Android player updates and serves only this HTML.

| Cue | Frames | PCM SHA-256 |
|---|---:|---|
| Wood | 6192 | `68135caf9ea6b388b5a1fe311d18236bc7ddef04a4abe4da86802aeee74777f0` |
| Defeat | 13200 | `014aeabc35f1f164f3f0f52d90daceadae5d04dc07ec4d9bdf12150ae4185ecc` |
