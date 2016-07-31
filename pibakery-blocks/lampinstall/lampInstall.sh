#!/bin/bash
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get -y install apache2 mysql-server php5
