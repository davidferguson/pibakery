#!/usr/bin/python

import sys, os, time

PIAUDIO = sys.argv[1]

if PIAUDIO == "AudioJack":
	os.system("sed -i 's/#hdmi_drive=2/hdmi_drive=1/' /boot/config.txt")

if PIAUDIO == "HDMI":
	os.system("sed -i 's/#hdmi_drive=2/hdmi_drive=2/' /boot/config.txt")



