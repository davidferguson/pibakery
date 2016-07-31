#!/bin/bash
if [ $2 == "root" ]; then
  python "$1"
else
  su - pi -c "python \"$1\""
fi
