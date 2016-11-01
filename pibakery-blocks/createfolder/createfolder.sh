#!/bin/bash
if [ $2 == "root" ]; then
  su - root -c 'mkdir "$1"'
else
  su - pi -c 'mkdir "$1"'
fi
