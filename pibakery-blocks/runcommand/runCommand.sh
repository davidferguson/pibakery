#!/bin/bash
if [ $2 == "root" ]; then
  $1
else
  su - pi -c "$1"
fi
