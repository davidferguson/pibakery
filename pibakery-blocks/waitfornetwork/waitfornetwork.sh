#!/bin/bash
VAL=1
if [ $1 == "Yes" ]; then
VAL=0
fi
raspi-config nonint do_boot_wait $VAL
