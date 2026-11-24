# 白環の大神殿：囁き / 白環の大神殿：目覚め

48秒の循環曲を2本、新規作曲・編曲。静穏版はフルートの息と、稀に鳴る小さな鐘・ハープ、弦の長い持続音。戦闘版は同じ時間軸を低弦と控えめな半音の影で変奏。既存作品の曲・旋律・音源は使用していません。鐘は自作の倍音合成です。

実演原音は既採用の [Versilian Studios Chamber Orchestra 2 Community Edition](https://versilian-studios.com/vsco-community/)、[CC0 1.0](https://github.com/sgossner/VSCO-2-CE/blob/440300901dfe9275fd84e0b7763af1f8443ae62e/LICENSE) の固定リビジョンより。元録音 Sam Gossner / Simon Dalzell、サンプル編集 Elan Hickler / Soundemote。既存本作の field intake の `sources.json` と照合して原音4件 `flute-a` / `cello-d` / `viola-a` / `harp-a` の blob を検証。再生成は `python compose.py PATH_TO_EXISTING_FIELD_INTAKE`（NumPy/SciPy、FFmpeg libvorbis）。作品に埋めるのは完成した2ファイルだけ。ネット取得なし。

- 静穏版 Git production PCM source: `white-ring-whisper.ogg` SHA256 `e3447805c97635182551f87a0db92f873d789665a5380170a6528c6b64020a23`、24 kHz stereo / 1,152,000 decoded frames、peak 0.435 / RMS 0.059。
- 戦闘版 `white-ring-waking.ogg` SHA256 `1b3795204966408d4d1183319d1bc99eac5e6b58efc6f77a20cd888d76221341`、同24 kHz stereo / 1,152,000 frames、peak 0.327 / RMS 0.069。

Both buffers remain silent while decoding and use the game's existing BGM switch/retirement/foreground controls. First score establishes phase epoch. The second cue seeks to matching phase before transport fades; a short arena-side retention avoids doorway jitter. No alternate unrelated synth during decoding or on unavailable WebView codec.
