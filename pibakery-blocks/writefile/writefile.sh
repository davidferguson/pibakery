#!/bin/bash

if [ "$#" -gt 0 ]
then
    result=`echo "$2" | tr '$3' '\n'`
    echo $result >> /home/pi/log
    echo $result > $1
    if [ "$4" = "Executable" ]
    then
        chmod +x $1
    fi
else
    echo "No parameters specified.  Aborting file write."
fi