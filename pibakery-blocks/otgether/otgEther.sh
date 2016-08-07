#!/bin/bash

# Add the line to /boot/config.txt if it's not already there
if ! grep -qxF "dtoverlay=dwc2" "/boot/config.txt"
then
  echo "dtoverlay=dwc2" | tee -a /boot/config.txt
fi

# Add the line to /etc/modules if it's not already there
if ! grep -qxF "dwc2" "/etc/modules"
then
  echo "dwc2" | tee -a /etc/modules
fi

# Remove any modules currently in /etc/modules
otg_modules=( "g_serial" "g_ether" "g_mass_storage" "g_midi" "g_audio" "g_hid" "g_acm_ms" "g_cdc" "g_multi" "g_webcam" "g_printer" "g_zero" )
for module in "${otg_modules[@]}"
do
  if grep -qxF "$module" "/etc/modules"
  then
    grep -v "$module" "/etc/modules" > "/etc/modules2"; mv "/etc/modules2" "/etc/modules"
  fi
done

# Disable the g_mass_storage startup script if it exists
if [ -f /etc/systemd/system/otgmassstorage.service ]
then
  systemctl disable /etc/systemd/system/otgmassstorage.service
fi

# Add g_ether to /etc/modules
echo "g_ether" | tee -a /etc/modules

# Remove the static IP stuff from /etc/dhcpcd.conf if it exists
startLine=$(grep -n "interface usb0 " /etc/dhcpcd.conf | cut -d : -f 1)
if [ ! -z "$startLine" ]
then
  matchLine=$((startLine+1))
  grep -n "static " /etc/dhcpcd.conf | cut -d : -f 1 | while read line
  do
    if [ $line -eq $matchLine ]
    then
      endLine=$line
      sed -i "${startLine}d;${endLine}d" /etc/dhcpcd.conf
    fi
  done
fi

# Add the static IP to /etc/dhcpcd.conf
echo -e "interface usb0 \nstatic ip_address=$1" | tee -a /etc/dhcpcd.conf
