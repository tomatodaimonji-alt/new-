# Original regional soundtrack

v346 changes six ordinary music cues. The existing runtime routing, volume,
fade transport, and offline playback are unchanged. Town, outside, snow,
and Orvas temple and battle audio, all ambience, and all sound effects are
unchanged. Selnea continues to share the indoor cue; the ordinary battle cue
does not replace Orvas's battle music.

| Scene | Cue | Musical role |
|---|---|---|
| town (unchanged) | 朝靄の灯 | Quiet harp opening and a late flute entry |
| indoor / Selnea | 潮灯りの窓 | A coastal three-beat chamber with a flute reply |
| mine | 霧の向こうの気配 | The approved 80-second score, recorded from the same master as the preview; harp, viola, cello, and flute |
| otherworld | 星映しの回廊 | Asymmetric, floating flute and harp |
| chapel | 石窓に宿る光 | Slow bowed suspensions and sparse melodic answers |
| northFort | 雪明かりの見張り台 | A distant muted-horn response against soft strings |
| ordinary battle | 光を追う足音 | Moving harp and cello voices, with momentum instead of hard percussion |

The six new scores use no oboe, in their recorded or fallback form. Attacks
are softened and releases overlap or sustain naturally. The original
compositions use recorded instruments from
[VSCO 2 Community Edition (CC0-1.0)](https://github.com/sgossner/VSCO-2-CE/blob/440300901dfe9275fd84e0b7763af1f8443ae62e/LICENSE).
Upstream credits the recording to Sam Gossner and Simon Dalzell, and cutting
to Elan Hickler/Soundemote. Exact source provenance and output hashes are
in `recorded-region-bgm-manifest.json`.

The seven embedded ordinary cues are 32 kHz stereo Vorbis (2,522,237 bytes),
with per-scene native sample endpoints; decoded lengths are 61.71–80.00
seconds. Measured loudness is −24.0 to −23.0 LUFS, with maximum true peak
−10.4 dBTP. The game retains at most one decoded ordinary BGM recording
in its cache; other music families are unaffected. No external request is
needed to play a bundled cue.

Verification: `tests/regional-soundtrack.test.cjs` for embedded hashes,
fallback data and unchanged protected source. `tests/recorded-zone-browser.mjs`
for actual browser decoding, existing BGM/SFX separation and town → mine →
Selnea behavior.
