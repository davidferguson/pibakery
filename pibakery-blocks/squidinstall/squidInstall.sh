#!/bin/bash
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get -y install "squid"

# A script to install and configure Squid Proxy Server for Raspberry Pi
#
# Command: sudo bash squid.sh

SOURCEFILE="/etc/squid/old.conf"
TARGETFILE="/etc/squid/squid.conf"

if [ ! -f $SOURCEFILE ]
then
    mv $TARGETFILE $SOURCEFILE
fi

rm $TARGETFILE
grep -v '^ *#' $SOURCEFILE | grep -v '^[  ]#' | grep -v '^$' > $TARGETFILE

echo  >> $TARGETFILE

echo acl my_lan src $1/$2 >> $TARGETFILE
echo http_access allow my_lan >> $TARGETFILE
echo icp_access allow my_lan >> $TARGETFILE

perl -p -i -e '
s/.*http_access deny all.*/http_access allow all/;
' "$TARGETFILE"

perl -p -i -e '
s/.*http_port 3128.*/http_port $3/;
' "$TARGETFILE"

service squid restart