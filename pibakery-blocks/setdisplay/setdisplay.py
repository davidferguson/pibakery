#!/usr/bin/python

import sys, os, time

PIDISPLAY = sys.argv[1]

if PIDISPLAY == "1024x768":
	os.system("sed -i 's/#hdmi_force_hotplug=1/hdmi_force_hotplug=1/' /boot/config.txt")
	os.system("sed -i 's/#hdmi_group=1/hdmi_group=2/' /boot/config.txt")
	os.system("sed -i 's/#hdmi_mode=1/hdmi_mode=16/' /boot/config.txt")

if PIDISPLAY == "720p":
	os.system("sed -i 's/#hdmi_force_hotplug=1/hdmi_force_hotplug=1/' /boot/config.txt")
	os.system("sed -i 's/#hdmi_group=1/hdmi_group=1/' /boot/config.txt")
	os.system("sed -i 's/#hdmi_mode=1/hdmi_mode=4/' /boot/config.txt")

if PIDISPLAY == "1080p":
	os.system("sed -i 's/#hdmi_force_hotplug=1/hdmi_force_hotplug=1/' /boot/config.txt")
	os.system("sed -i 's/#hdmi_group=1/hdmi_group=1/' /boot/config.txt")
	os.system("sed -i 's/#hdmi_mode=1/hdmi_mode=16/' /boot/config.txt")

if PIDISPLAY == "1440x900":
	os.system("sed -i 's/#hdmi_force_hotplug=1/hdmi_force_hotplug=1/' /boot/config.txt")
	os.system("sed -i 's/#hdmi_group=1/hdmi_group=2/' /boot/config.txt")
	os.system("sed -i 's/#hdmi_mode=1/hdmi_mode=47/' /boot/config.txt")

if PIDISPLAY == "1280x1024":
	os.system("sed -i 's/#hdmi_force_hotplug=1/hdmi_force_hotplug=1/' /boot/config.txt")
	os.system("sed -i 's/#hdmi_group=1/hdmi_group=2/' /boot/config.txt")
	os.system("sed -i 's/#hdmi_mode=1/hdmi_mode=35/' /boot/config.txt")

if PIDISPLAY == "1280x960":
	os.system("sed -i 's/#hdmi_force_hotplug=1/hdmi_force_hotplug=1/' /boot/config.txt")
	os.system("sed -i 's/#hdmi_group=1/hdmi_group=2/' /boot/config.txt")
	os.system("sed -i 's/#hdmi_mode=1/hdmi_mode=32/' /boot/config.txt")

if PIDISPLAY == "1280x800":
	os.system("sed -i 's/#hdmi_force_hotplug=1/hdmi_force_hotplug=1/' /boot/config.txt")
	os.system("sed -i 's/#hdmi_group=1/hdmi_group=2/' /boot/config.txt")
	os.system("sed -i 's/#hdmi_mode=1/hdmi_mode=28/' /boot/config.txt")

if PIDISPLAY == "800x600":
	os.system("sed -i 's/#hdmi_force_hotplug=1/hdmi_force_hotplug=1/' /boot/config.txt")
	os.system("sed -i 's/#hdmi_group=1/hdmi_group=2/' /boot/config.txt")
	os.system("sed -i 's/#hdmi_mode=1/hdmi_mode=9/' /boot/config.txt")





