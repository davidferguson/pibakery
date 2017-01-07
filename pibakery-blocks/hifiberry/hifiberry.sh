#!/bin/bash

# Determine driver overlay
if [ "$1" == "DAC" ]
then
  OVERLAY="dtoverlay=hifiberry-dac"
elif [ "$1" == "DAC+" ]
then
  OVERLAY="dtoverlay=hifiberry-dacplus"
elif [ "$1" == "Digi/Digi+" ]
then
  OVERLAY="dtoverlay=hifiberry-digi"
elif [ "$1" == "Amp+" ]
then
  OVERLAY="dtoverlay=hifiberry-amp"
fi

# Add the line to /boot/config.txt if it's not already there
if ! grep -qxF "dtoverlay=hifiberry.*" "/boot/config.txt"
then
  echo $OVERLAY | tee -a /boot/config.txt
else
  sed 's/^dtoverlay=hifiberry.*/$OVERLAY/' -i /boot/config.txt
fi

# Disable on-board sound card
if [ "$2" == "TRUE" ]
then
  sed 's/^dtparam=audio=on/#dtparam=audio=on/' -i /boot/config.txt
fi

# Add ALSA configuration
if [ "$3" == "TRUE" ]
then
  echo -e "pcm.!default {\n\ttype hw card 0\n}\nctl.!default {\n\ttype hw card 0\n}\n" >> /etc/asound.conf
fi
