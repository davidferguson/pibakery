#!/bin/sh
# Originally part of raspi-config https://github.com/RPi-Distro/raspi-config
# Edited by David Ferguson for PiBakery
# See https://github.com/RPi-Distro/raspi-config/blob/master/LICENSE for copyright and license details

BOOTOPTION=$1

get_init_sys() {
  if command -v systemctl > /dev/null && systemctl | grep -q '\-\.mount'; then
    SYSTEMD=1
  elif [ -f /etc/init.d/cron ] && [ ! -h /etc/init.d/cron ]; then
    SYSTEMD=0
  else
    echo "Unrecognised init system"
    return 1
  fi
}

do_boot_behaviour_new() {
  get_init_sys
  BOOTOPT=$BOOTOPTION
  if [ $? -eq 0 ]; then
    case "$BOOTOPT" in
      "Console")
        #boot to console
        if [ $SYSTEMD -eq 1 ]; then
          systemctl set-default multi-user.target
          ln -fs /lib/systemd/system/getty@.service /etc/systemd/system/getty.target.wants/getty@tty1.service
        else
          [ -e /etc/init.d/lightdm ] && update-rc.d lightdm disable 2
          sed /etc/inittab -i -e "s/1:2345:respawn:\/bin\/login -f pi tty1 <\/dev\/tty1 >\/dev\/tty1 2>&1/1:2345:respawn:\/sbin\/getty --noclear 38400 tty1/"
        fi
        ;;
      "Console logged in")
        #boot to console logged in
        if [ $SYSTEMD -eq 1 ]; then
          systemctl set-default multi-user.target
          ln -fs /etc/systemd/system/autologin@.service /etc/systemd/system/getty.target.wants/getty@tty1.service
        else
          [ -e /etc/init.d/lightdm ] && update-rc.d lightdm disable 2
          sed /etc/inittab -i -e "s/1:2345:respawn:\/sbin\/getty --noclear 38400 tty1/1:2345:respawn:\/bin\/login -f pi tty1 <\/dev\/tty1 >\/dev\/tty1 2>&1/"
        fi
        ;;
      "Desktop")
        #boot to desktop
        if [ -e /etc/init.d/lightdm ]; then
          if [ $SYSTEMD -eq 1 ]; then
            systemctl set-default graphical.target
            ln -fs /lib/systemd/system/getty@.service /etc/systemd/system/getty.target.wants/getty@tty1.service
          else
            update-rc.d lightdm enable 2
          fi
          sed /etc/lightdm/lightdm.conf -i -e "s/^autologin-user=pi/#autologin-user=/"
        else
          #whiptail --msgbox "Do sudo apt-get install lightdm to allow configuration of boot to desktop" 20 60 2
          echo "Do sudo apt-get install lightdm to allow configuration of boot to desktop"
          return 1
        fi
        ;;
      "Desktop logged in")
        #boot to desktop logged in
        if [ -e /etc/init.d/lightdm ]; then
          if id -u pi > /dev/null 2>&1; then
            if [ $SYSTEMD -eq 1 ]; then
              systemctl set-default graphical.target
              ln -fs /etc/systemd/system/autologin@.service /etc/systemd/system/getty.target.wants/getty@tty1.service
            else
              update-rc.d lightdm enable 2
            fi
            sed /etc/lightdm/lightdm.conf -i -e "s/^#autologin-user=.*/autologin-user=pi/"
          else
            #whiptail --msgbox "The pi user has been removed, can't set up boot to desktop" 20 60 2
            echo "The pi user has been removed, can't set up boot to desktop"
          fi
        else
          #whiptail --msgbox "Do sudo apt-get install lightdm to allow configuration of boot to desktop" 20 60 2
          echo "Do sudo apt-get install lightdm to allow configuration of boot to desktop"
          return 1
        fi
        ;;
      *)
        #whiptail --msgbox "Programmer error, unrecognised boot option" 20 60 2
        echo "Programmer error, unrecognised boot option"
        return 1
        ;;
    esac
  fi
}

echo $1
do_boot_behaviour_new