#!/bin/bash

# Create a zip file of the extension
zip -vr print-gemini-storybook.zip \
  manifest.json \
  background.js \
  style.css \
  generator.html \
  generator.js \
  icons/icon16.png \
  icons/icon32.png \
  icons/icon48.png \
  icons/icon128.png \
  lib/pdf-lib.min.js \
  lib/fontkit.umd.min.js \
  fonts/poppins-latin-400-normal.ttf \
  fonts/poppins-latin-500-normal.ttf

echo "Extension packaged into print-gemini-storybook.zip"