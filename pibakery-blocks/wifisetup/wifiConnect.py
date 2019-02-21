#!/usr/bin/python

import sys, os, time

openWifi = """

network={
    ssid="WIFI-SSID"
    scan_ssid=1
    key_mgmt=NONE
}"""

wepWifi = """

network={
    ssid="WIFI-SSID"
    scan_ssid=1
    key_mgmt=NONE
    wep_key0="WIFI-PSK"
}"""

wpaWifi = """

network={
    ssid="WIFI-SSID"
    scan_ssid=1
    key_mgmt=WPA-PSK
    psk="WIFI-PSK"
}"""

wifiSSID = sys.argv[1]
wifiPSK = sys.argv[2]
wifiType = sys.argv[3]
countryCode = sys.argv[4]

if wifiSSID != "" and wifiType != "":
	if wifiPSK == "" or wifiType == "Open (no password)":
		wifiText = openWifi.replace("WIFI-SSID", wifiSSID)
	elif wifiType == "WEP":
		wifiText = wepWifi.replace("WIFI-SSID", wifiSSID).replace("WIFI-PSK", wifiPSK)
	elif wifiType == "WPA/WPA2":
		wifiText = wpaWifi.replace("WIFI-SSID", wifiSSID).replace("WIFI-PSK", wifiPSK)

# raspbian 2018-03-14 now requires us to have the country= line.
os.system('raspi-config nonint do_wifi_country "' + countryCode + '"')

with open("/etc/wpa_supplicant/wpa_supplicant.conf", "a") as wifiFile:
	wifiFile.write(wifiText)

os.system("wpa_cli -i wlan0 reconfigure")
time.sleep(5)
#os.system("systemctl daemon-reload")
#time.sleep(5)
#os.system("systemctl restart dhcpcd")
#time.sleep(5)

# It's likely that the block following this one will be one that uses the
# internet - such as a download file or apt-get block. It takes a few seconds
# for the WiFi to connect and obtain an IP address, run the waitForNetwork shell
# script, which will loop waiting for a network connection (timeout 150 seconds)
# and continue once there is one
os.system("chmod +x /boot/PiBakery/blocks/wifisetup/waitForNetwork.sh")
os.system("/boot/PiBakery/blocks/wifisetup/waitForNetwork.sh")
