#!/bin/bash

openvt -s -w /opt/PiBakery/runscripts.sh
sleep 1

while pidof -x "/opt/PiBakery/runscripts.sh" >/dev/null
do
  sleep 10
done

exit 0
