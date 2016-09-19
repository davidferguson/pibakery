#!/bin/bash

if [ "$1" == "Enable" ]
then
  raspi-config nonint do_spi 0
else
  raspi-config nonint do_spi 1
fi
