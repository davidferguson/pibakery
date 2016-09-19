#!/bin/bash

if [ "$1" == "Enable" ]
then
  raspi-config nonint do_serial 0
else
  raspi-config nonint do_serial 1
fi
