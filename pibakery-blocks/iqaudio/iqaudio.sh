#!/bin/bash

# Add the line to /boot/config.txt if it's not already there
if ! grep -qxF "dtoverlay=iqaudio-dacplus,unmute_amp" "/boot/config.txt"
then
  echo "dtoverlay=iqaudio-dacplus,unmute_amp" | tee -a /boot/config.txt
fi

if [ "$1" == "TRUE" ]
then
  if grep -qxF "dtparam=audio=on" "/boot/config.txt"
  then
    grep -v "dtparam=audio=on" "/boot/config.txt" > "/boot/config.txt2"; mv "/boot/config.txt2" "/boot/config.txt"
  fi
fi
