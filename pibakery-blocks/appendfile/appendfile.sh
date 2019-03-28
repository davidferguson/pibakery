#!/bin/bash

if [ "$#" -gt 0 ]
then
    if [ -n "$3" ]
    then
        result=`echo "$2" | tr '$3' '\n'`
    fi
    echo $result >> $1
else
    echo "No parameters specified.  Aborting file append."
fi