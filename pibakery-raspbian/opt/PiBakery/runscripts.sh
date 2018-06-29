#!/bin/bash

# Setup the environment for whiptail
export TERM="linux"

# If there are blocks that need a network connection, run waitForNetwork.sh
if [ -f /boot/PiBakery/waitForNetwork ]
then
  /opt/PiBakery/waitForNetwork.sh || /bin/true
fi

# Make sure the scripts are executable
chmod +x /boot/PiBakery/firstBoot.sh || /bin/true
chmod +x /boot/PiBakery/nextBoot.sh || /bin/true
chmod +x /boot/PiBakery/everyBoot.sh || /bin/true

# Run the firstBoot script, and prevent it from running again
if [ -f /boot/PiBakery/runFirstBoot ]
then
  rm -f /boot/PiBakery/runFirstBoot || /bin/true
  # If we should wait for network, run the waitForNetwork.sh script
  if [ -f /boot/PiBakery/waitForNetworkFirstBoot ]
  then
    /opt/PiBakery/waitForNetwork.sh || /bin/true
  fi
  /usr/bin/python /opt/PiBakery/removeFirst.py || /bin/true
  /boot/PiBakery/firstBoot.sh || /bin/true
fi

# Run the nextBoot script, and prevent it from running again
if [ -f /boot/PiBakery/runNextBoot ]
then
  rm -f /boot/PiBakery/runNextBoot || /bin/true
  # If we should wait for network, run the waitForNetwork.sh script
  if [ -f /boot/PiBakery/waitForNetworkNextBoot ]
  then
    /opt/PiBakery/waitForNetwork.sh || /bin/true
  fi
  /usr/bin/python /opt/PiBakery/removeNext.py || /bin/true
  /boot/PiBakery/nextBoot.sh || /bin/true
fi

# Run the everyBoot script
if [ -f /boot/PiBakery/waitForNetworkEveryBoot ]
then
  /opt/PiBakery/waitForNetwork.sh || /bin/true
fi
/boot/PiBakery/everyBoot.sh || /bin/true

exit 0
