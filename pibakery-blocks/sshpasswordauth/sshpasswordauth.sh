#!/bin/bash

if [ "$1" == "Enable" ]
then
	sed -re 's/^(\#?)(PasswordAuthentication)([[:space:]]+)(no|yes)[[:space:]]*$/\2\3yes/' -i /etc/ssh/sshd_config
else
	sed -re 's/^(\#?)(PasswordAuthentication)([[:space:]]+)(no|yes)[[:space:]]*$/\2\3no/' -i /etc/ssh/sshd_config
fi
systemctl reload sshd
