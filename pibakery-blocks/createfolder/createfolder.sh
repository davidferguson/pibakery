#!/bin/bash
if [ $2 == "root" ]; then
  su - root -c 'mkdir "$1"'
else
  sudo -u pi mkdir "$1"
fi
