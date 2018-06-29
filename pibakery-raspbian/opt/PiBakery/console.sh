#!/bin/bash

DEFAULT=$(systemctl get-default)

if [ $DEFAULT == "multi-user.target" ]
then
  /opt/PiBakery/startup.sh
fi
exit 0
