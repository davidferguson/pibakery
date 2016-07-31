#!/bin/bash

for ((i=0;i<50;i++))
do
  ping -w 1 8.8.8.8 >/dev/null 2>&1
  if [ $? -eq 0 ]
  then
    sleep 1
    break
  fi
  sleep 4
done
