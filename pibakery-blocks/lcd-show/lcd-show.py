#!/usr/bin/python

import sys, os, time

LCDVER = sys.argv[1]
ROTATE = sys.argv[2]
os.system("wget -O /home/pi/LCD-show.tar.gz http://www.waveshare.com/w/upload/4/4b/LCD-show-161112.tar.gz)"
os.system("tar xvf /home/pi/LCD-show.tar.gz -C /home/pi/")
os.system("sudo sed -i 's/sudo reboot/#sudo reboot/' /home/pi/LCD-show/LCD35-show")
os.system("sudo sed -i 's/sudo reboot/#sudo reboot/' /home/pi/LCD-show/LCD4-800x480-show")
os.system("sudo sed -i 's/sudo reboot/#sudo reboot/' /home/pi/LCD-show/LCD4-show")
os.system("sudo sed -i 's/sudo reboot/#sudo reboot/' /home/pi/LCD-show/LCD5-show")
os.system("sudo sed -i 's/sudo reboot/#sudo reboot/' /home/pi/LCD-show/LCD7-800x480-show")
os.system("sudo sed -i 's/sudo reboot/#sudo reboot/' /home/pi/LCD-show/LCD7-1024x600-show")
os.system("sudo sed -i 's/sudo reboot/#sudo reboot/' /home/pi/LCD-show/LCD28-show")
os.system("sudo sed -i 's/sudo reboot/#sudo reboot/' /home/pi/LCD-show/LCD32-show")
os.system("sudo sed -i 's/sudo reboot/#sudo reboot/' /home/pi/LCD-show/LCD35B-show")
os.system("sudo sed -i 's/sudo reboot/#sudo reboot/' /home/pi/LCD-show/LCD43-show")
os.system("sudo sed -i 's/sudo reboot/#sudo reboot/' /home/pi/LCD-show/LCD101-1024x600-show")

os.system("sudo sed -i 's/\.\//\/home\/pi\/LCD-show\//' /home/pi/LCD-show/LCD35-show")
os.system("sudo sed -i 's/\.\//\/home\/pi\/LCD-show\//' /home/pi/LCD-show/LCD4-800x480-show")
os.system("sudo sed -i 's/\.\//\/home\/pi\/LCD-show\//' /home/pi/LCD-show/LCD4-show")
os.system("sudo sed -i 's/\.\//\/home\/pi\/LCD-show\//' /home/pi/LCD-show/LCD5-show")
os.system("sudo sed -i 's/\.\//\/home\/pi\/LCD-show\//' /home/pi/LCD-show/LCD7-800x480-show")
os.system("sudo sed -i 's/\.\//\/home\/pi\/LCD-show\//' /home/pi/LCD-show/LCD7-1024x600-show")
os.system("sudo sed -i 's/\.\//\/home\/pi\/LCD-show\//' /home/pi/LCD-show/LCD28-show")
os.system("sudo sed -i 's/\.\//\/home\/pi\/LCD-show\//' /home/pi/LCD-show/LCD32-show")
os.system("sudo sed -i 's/\.\//\/home\/pi\/LCD-show\//' /home/pi/LCD-show/LCD35B-show")
os.system("sudo sed -i 's/\.\//\/home\/pi\/LCD-show\//' /home/pi/LCD-show/LCD43-show")
os.system("sudo sed -i 's/\.\//\/home\/pi\/LCD-show\//' /home/pi/LCD-show/LCD101-1024x600-show")

os.system("sudo /home/pi/LCD-show/"+ LCDVER + "-show " + ROTATE)
os.system("sudo apt-get install -y xinput-calibrator")
