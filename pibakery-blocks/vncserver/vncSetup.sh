#!/bin/bash

umask 0077
mkdir -p "/home/pi/.vnc"
chmod go-rwx "/home/pi/.vnc"
vncpasswd -f <<<"$1" >"/home/pi/.vnc/passwd"
vncserver :1
