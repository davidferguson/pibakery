#!/bin/bash

rm /etc/ssh/ssh_host_*
dpkg-reconfigure openssh-server
