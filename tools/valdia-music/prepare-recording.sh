#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo '819f42337a494f59a4359a70103a450e69e502a1  candidates/romanza.ogv' | sha1sum -c -
ffmpeg -y -hide_banner -v error -i candidates/romanza.ogv -map_metadata -1 \
  -filter_complex '[0:a:0]asplit[a][b];[a]atrim=start=0.43:end=29.68,asetpts=PTS-STARTPTS[a1];[b]atrim=start=58.98:end=89.35,asetpts=PTS-STARTPTS[b1];[a1][b1]acrossfade=d=0.08:c1=tri:c2=tri,highpass=f=48,treble=g=-2:f=3300,acompressor=threshold=0.1:ratio=2.1:attack=6:release=105:makeup=1.14:knee=3.2:link=maximum:detection=peak,pan=mono|c0=0.5*c0+0.5*c1,alimiter=limit=0.355:attack=5:release=65:level=0:latency=1,afade=t=in:d=0.14,afade=t=out:st=59.12:d=0.42[out]' \
  -map '[out]' -ar 24000 -c:a libvorbis -q:a 3 -metadata title="Romanza Española" \
  -metadata artist="Alisa Gladyseva" -metadata license="CC0 1.0 Universal" \
  -metadata original_sha1=819f42337a494f59a4359a70103a450e69e502a1 valdia-acoustic.ogg
