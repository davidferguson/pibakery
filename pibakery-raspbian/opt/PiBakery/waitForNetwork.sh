#!/bin/bash

{
for ((i=0;i<50;i++))
do
  echo $(expr $i \* 2)
  ping -w 1 8.8.8.8 >/dev/null 2>&1
  if [ $? -eq 0 ]
  then
    echo 100
    sleep 1
    break
  fi
  sleep 3
done
} | whiptail --title "PiBakery" --gauge "\nWaiting for network connection..." 8 40 0
