#!/usr/bin/python

import sys, os, time

Lantxt = """

interface eth0
static ip_address=myip
static routers=mygw
static domain_name_servers=mydns
"""

WLantxt0 = """

interface wlan0
static ip_address=myip
static routers=mygw
static domain_name_servers=mydns
"""

WLantxt1 = """

interface wlan1
static ip_address=myip
static routers=mygw
static domain_name_servers=mydns
"""

netType = sys.argv[1]
newIP = sys.argv[2]
newGW = sys.argv[3]
newDNS = sys.argv[4]

if newIP != "":
	if netType == "eth0":
		ipText = Lantxt.replace("myip", newIP).replace("mygw", newGW).replace("mydns", newDNS)
	elif netType == "wlan0":
		ipText = WLantxt0.replace("myip", newIP).replace("mygw", newGW).replace("mydns", newDNS)
	elif netType == "wlan1":
		ipText = WLantxt1.replace("myip", newIP).replace("mygw", newGW).replace("mydns", newDNS)

with open("/etc/dhcpcd.conf", "a") as ipFile:
	ipFile.write(ipText)

os.system("sudo /etc/init.d/networking restart")
time.sleep(10)
os.system("sudo /etc/init.d/networking reload")
time.sleep(10)

# It's likely that the block following this one will be one that uses the
# internet - such as a download file or apt-get block. It takes a few seconds
# for the WiFi to connect and obtain an IP address, run the waitForNetwork shell
# script, which will loop waiting for a network connection (timeout 150 seconds)
# and continue once there is one
#os.system("chmod +x /boot/PiBakery/blocks/wifisetup/waitForNetwork.sh")
#os.system("/boot/PiBakery/blocks/wifisetup/waitForNetwork.sh")

