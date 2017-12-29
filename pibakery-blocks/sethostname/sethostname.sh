#!/bin/bash

raspi-config nonint do_hostname "$1"
hostname -b "$1"
systemctl restart avahi-daemon
