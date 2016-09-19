#!/bin/bash

if [ "$1" == "Enable" ]
then
  raspi-config nonint do_i2c 0
else
  raspi-config nonint do_i2c 1
fi
