#!/bin/bash

#megabytes=$1
#kilobytes=$((megabytes * 1024))
#bytes=$((kilobytes * 1024))

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

# Add g_acm_ms to /etc/modules
echo "g_mass_storage" | tee -a /etc/modules

if [ ! -d /opt/otgmassstorage ]
then
  mkdir /opt/otgmassstorage
fi

if [ ! -f /opt/otgmassstorage/filesystem.bin ]
then
  dd if=/dev/zero of=/opt/otgmassstorage/filesystem.bin bs=512 count=2880
  mkdosfs /opt/otgmassstorage/filesystem.bin
fi

if [ ! -f /etc/systemd/system/otgmassstorage.service ]
then
  /bin/cat <<EOF >/etc/systemd/system/otgmassstorage.service
[Unit]
Description=Starts kernel modules for USB OTG
After=systemd-remount-fs.service
DefaultDependencies=false

[Service]
Type=simple
ExecStart=/opt/otgmassstorage/start.sh
WorkingDirectory=/opt/otgmassstorage/

[Install]
WantedBy=local-fs.target
EOF
fi

if [ ! -f /opt/otgmassstorage/start.sh ]
then
  /bin/cat <<EOF >/opt/otgmassstorage/start.sh
#!/bin/sh -e

modprobe g_mass_storage file=/opt/otgmassstorage/filesystem.bin stall=0
exit 0
EOF
fi

chmod +x /etc/systemd/system/otgmassstorage.service
chmod +x /opt/otgmassstorage/start.sh

systemctl enable /etc/systemd/system/otgmassstorage.service
