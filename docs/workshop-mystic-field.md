# 星霧の野 | 3Dワールド工房 オリジナル

Field-only cue; original 16-bar arrangement at 84 BPM. The melody/harmony were independently written. No game themes, lifted score, synthetic instruments, or third-party music recordings used. All playable sounds originated in these eight instruments takes: airy flute, viola section and cello section, with sparse harp and no drums.

Instrument recordings: **Versilian Studios VSCO 2 Community Edition**, recorded by Sam Gossner and Simon Dalzell; sample cutting by Elan Hickler/Soundemote. [Official source and CC0 statement](https://versilian-studios.com/vsco-community/), [original repository project credits](https://github.com/sgossner/VSCO-2-CE), [pinned CC0-1.0 license](https://github.com/sgossner/VSCO-2-CE/blob/440300901dfe9275fd84e0b7763af1f8443ae62e/LICENSE).

## Exact source WAVs

- [Woodwinds/Flute/susNV/LDFlute_susNV_A4_v1_1.wav](https://github.com/sgossner/VSCO-2-CE/blob/440300901dfe9275fd84e0b7763af1f8443ae62e/Woodwinds/Flute/susNV/LDFlute_susNV_A4_v1_1.wav) (3460842 bytes; Git blob `3007213aa6264efe0619c7321bf2e8df7966b0a2`).
- [Woodwinds/Flute/susNV/LDFlute_susNV_C5_v1_1.wav](https://github.com/sgossner/VSCO-2-CE/blob/440300901dfe9275fd84e0b7763af1f8443ae62e/Woodwinds/Flute/susNV/LDFlute_susNV_C5_v1_1.wav) (2491416 bytes; Git blob `093129d6a876ce5f004279b2979894d0ed637a8d`).
- [Strings/Viola Section/trem/Violas_trem_A3_v1_rr1.wav](https://github.com/sgossner/VSCO-2-CE/blob/440300901dfe9275fd84e0b7763af1f8443ae62e/Strings/Viola%20Section/trem/Violas_trem_A3_v1_rr1.wav) (2074040 bytes; Git blob `da970517a0b4ec56b49aa41133b3ed7bc142d01a`).
- [Strings/Viola Section/trem/Violas_trem_E4_v1_rr1.wav](https://github.com/sgossner/VSCO-2-CE/blob/440300901dfe9275fd84e0b7763af1f8443ae62e/Strings/Viola%20Section/trem/Violas_trem_E4_v1_rr1.wav) (2187412 bytes; Git blob `9a63f06c388479300c3e0a9a65448cba2efa84c7`).
- [Strings/Cello Section/susvib/susvib_D2_v1_1.wav](https://github.com/sgossner/VSCO-2-CE/blob/440300901dfe9275fd84e0b7763af1f8443ae62e/Strings/Cello%20Section/susvib/susvib_D2_v1_1.wav) (2550956 bytes; Git blob `8076f809d4f6a8057f3835e12d22751a25e39252`).
- [Strings/Cello Section/susvib/susvib_A2_v1_1.wav](https://github.com/sgossner/VSCO-2-CE/blob/440300901dfe9275fd84e0b7763af1f8443ae62e/Strings/Cello%20Section/susvib/susvib_A2_v1_1.wav) (2336738 bytes; Git blob `76df6b474aff133b2ac9d96bf2466cb6fd865c72`).
- [Strings/Harp/KSHarp_A4_mf.wav](https://github.com/sgossner/VSCO-2-CE/blob/440300901dfe9275fd84e0b7763af1f8443ae62e/Strings/Harp/KSHarp_A4_mf.wav) (2143618 bytes; Git blob `acbece38a84e886cb5516e0f29d6ff5d38900fe1`).
- [Strings/Harp/KSHarp_E5_mf.wav](https://github.com/sgossner/VSCO-2-CE/blob/440300901dfe9275fd84e0b7763af1f8443ae62e/Strings/Harp/KSHarp_E5_mf.wav) (1171586 bytes; Git blob `20675907d698db011d0c8bc72cf9af4e7a1ac971`).


The build resamples the original captured performances; FFT-measured concert roots account for a +12 semitone naming convention in the wind and bowed-string sources. It retains natural attacks, arranges parts at authored dynamics, and wraps sustain/reverb across the loop boundary. No original sample WAVs are embedded, only the final mixed Ogg. No network is needed to play it.

Final: 354,935 bytes, Vorbis, 32,000 Hz stereo, 1,462,857 exactly decoded samples per channel, 45.714281 s. SHA256: `796fe237681344be18337a900db1ca441b5b46c1b43a8f7f9adfff95442d960e`. Decoded −20.0 LUFS integrated, −8.2 dBTP peak, −21.95 dBFS RMS. Seam last-to-first channel deltas 0.000519 / 0.001935 full scale, both within typical nearby decoded adjacent transitions. Audio rendering checks are objective; listening/Android playback should be checked separately.

Reproduction: `python tools/workshop-mystic-field/compose.py` with the exact eight verified WAVs under `original/`, Python NumPy/SciPy and FFmpeg with libvorbis. Original sources and intake artifacts are not production assets.
