#!/bin/bash

if [ "$1" == "Enable" ]
then
  systemctl enable ssh
  systemctl start ssh
else
  systemctl disable ssh
  systemctl stop ssh
fi
