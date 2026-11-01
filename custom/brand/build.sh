#!/bin/sh
# Renders the Finance icons from the SVGs in this folder into $1, under the file
# names upstream's public/ uses, so no view has to point anywhere new.
# Needs rsvg-convert and ImageMagick (custom/Dockerfile installs both).
set -eu
SRC=$(dirname "$0")
OUT=$1
mkdir -p "$OUT/images"
png() { rsvg-convert -w "$2" -h "$2" "$SRC/$1" -o "$3"; }
png icon.svg 16 "$OUT/favicon-16x16.png"
png icon.svg 32 "$OUT/favicon-32x32.png"
png icon.svg 180 "$OUT/apple-touch-icon.png"
png maskable.svg 144 "$OUT/mstile-144x144.png"
for s in 72 76 96 120 128 144 152 180 192 384 512; do png maskable.svg $s "$OUT/maskable$s.png"; done
png icon.svg 200 "$OUT/images/logo-session.png"
magick "$OUT/favicon-16x16.png" "$OUT/favicon-32x32.png" "$OUT/favicon.ico"
cp "$SRC/icon.svg" "$OUT/favicon.svg"
cp "$SRC/mono.svg" "$OUT/safari-pinned-tab.svg"
cp "$SRC/manifest.webmanifest" "$OUT/manifest.webmanifest"
