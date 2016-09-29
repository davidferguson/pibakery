#!/bin/bash

if [ "$1" == "Enable" ]
then
  systemctl enable vncserver-x11-serviced.service
  systemctl start vncserver-x11-serviced.service
else
  systemctl disable vncserver-x11-serviced.service
  systemctl stop vncserver-x11-serviced.service
fi
