#!/usr/bin/python

import sys, os, time

SMBSERVER = sys.argv[1]
SMBLOCAL = sys.argv[2]
SMBUSERNAME = sys.argv[3]
SMBPASSWORD = sys.argv[4]
SMBDOMMAIN = sys.argv[5]
SMBFILE = sys.argv[6]
SMBDIR = sys.argv[7]

os.system('sudo -u pi mkdir "' + SMBLOCAL + '"')

SMBText = SMBSERVER + " " + SMBLOCAL + " cifs username=" + SMBUSERNAME + ",password=" + SMBPASSWORD
if SMBDOMMAIN != "":
SMBText = SMBText + ",domain=" + SMBDOMMAIN

SMBText = SMBText + ",file_mode=" + SMBFILE + ",dir_mode=" + SMBDIR + ",users,x-systemd.automount,noauto,user_xattr 0 0"
with open("/etc/fstab", "a") as fstabFile:
	fstabFile.write(SMBText)

os.system("mount -a")
