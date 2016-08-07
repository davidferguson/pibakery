#!/bin/bash

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
