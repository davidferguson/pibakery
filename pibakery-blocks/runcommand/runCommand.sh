#!/bin/bash
if [ $2 == "root" ]; then
  exec "$1"
else
  su - pi -c "$1"
fi
