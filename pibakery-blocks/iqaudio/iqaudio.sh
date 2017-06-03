#!/bin/bash

# Add the line to /boot/config.txt if it's not already there
if ! grep -qxF "dtoverlay=iqaudio-dacplus,unmute_amp" "/boot/config.txt"
then
  echo "dtoverlay=iqaudio-dacplus,unmute_amp" | tee -a /boot/config.txt
fi

if [ "$1" == "TRUE" ]
then
  sed 's/^dtparam=audio=on/#dtparam=audio=on/' -i /boot/config.txt
fi
