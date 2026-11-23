# Workshop orchestral soundtrack

All nine pieces are original and reproducible from `tools/compose_workshop_orchestral.py`.
The score is embedded into the standalone `world-editor.html` between the
`BEGIN ORIGINAL ORCHESTRA SCORE` and `END ORIGINAL ORCHESTRA SCORE` comments
for Android offline play. To revise it, run
`python tools/compose_workshop_orchestral.py /tmp/workshop-scores.js`, then
replace the contents between those markers with the generated file.

The native Web Audio transport plays the town, indoors, field, southern
market, mine, chapel, otherworld, north fort and battle cues. A nearby
committed attack or real damage briefly prioritizes the battle cue. The
existing BGM, effects, ambience and master gain settings remain independent.
