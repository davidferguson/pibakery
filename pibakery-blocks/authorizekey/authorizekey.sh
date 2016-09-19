#!/bin/bash

chmod +x /boot/PiBakery/blocks/authorizekey/authorizekey.py

if [ $2 == "root" ]; then
  /boot/PiBakery/blocks/authorizekey/authorizekey.py "$@"
else
  exec sudo -u pi -- "/boot/PiBakery/blocks/authorizekey/authorizekey.py" "$@"
fi
