#!/bin/bash

apt-get update
#DEBIAN_FRONTEND=noninteractive apt-get -y install tightvncserver
dpkg -i /boot/PiBakery/blocks/vncserver/xfonts-base_1.0.3_all.deb /boot/PiBakery/blocks/vncserver/tightvncserver_1.3.9-6.5_armhf.deb

chmod +x /boot/PiBakery/blocks/vncserver/vncSetup.sh
su - pi -c "/boot/PiBakery/blocks/vncserver/vncSetup.sh $@"
