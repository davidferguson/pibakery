#!/bin/bash
apt-get update
cd /home/pi
git clone --depth=1 https://github.com/RetroPie/RetroPie-Setup.git
cd /home/pi/RetroPie-Setup
./retropie_setup.sh
