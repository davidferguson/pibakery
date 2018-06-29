#!/bin/bash

DEFAULT=$(systemctl get-default)

if [ $DEFAULT == "graphical.target" ]
then
  /opt/PiBakery/startup.sh
  /usr/sbin/lightdm
fi
exit 0
