#!/usr/bin/python

import sys, os, time

PILED = sys.argv[1]

if PILED == "Enable":
	LEDText="disable_camera_led=0"

if PILED == "Disable":
	LEDText="disable_camera_led=1"
	
with open("/boot/config.txt", "a") as fstabFile:
	fstabFile.write(LEDText)

