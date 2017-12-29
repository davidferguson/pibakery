#!/bin/bash

#check to make sure that all the timings are either numbers or asterisks
timings=( "$1" "$2" "$3" "$4" "$5" )
for timing in "${timings[@]}"
do
  if ( ! [[ "$timing" =~ ^-?[0-9]+$ ]] ) && [ "$timing" != "*" ]
  then
    echo "invalid cron timing"
    exit 0
  fi
done

#check that the values for the timings are valid before inserting them into cron
if [ "$1" != "*" ] && ! [ "$1" -ge -1 -a "$1" -le 8 ]
then
  exit 1
fi

if [ "$2" != "*" ] && ! [ "$2" -ge 0 -a "$2" -le 13 ]
then
  exit 1
fi

if [ "$3" != "*" ] && ! [ "$3" -ge 0 -a "$3" -le 32 ]
then
  exit 1
fi

if [ "$4" != "*" ] && ! [ "$4" -ge 0 -a "$4" -le 24 ]
then
  exit 1
fi

if [ "$5" != "*" ] && ! [ "$5" -ge 0 -a "$5" -le 60 ]
then
  exit 1
fi

#if the timings are valid, then go ahead and insert them into cron
if [ $7 == "root" ]; then
  (crontab -l ; echo "$1 $2 $3 $4 $5 $6") | crontab -
else
  su - pi -c "(crontab -l ; echo \"$1 $2 $3 $4 $5 $6\") | crontab -"
fi

exit 0
