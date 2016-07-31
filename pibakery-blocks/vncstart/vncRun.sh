#!/bin/bash

if (( $1 > 5900 )); then
    port=$(( $1-5900 ))
else
    port=$1
fi

vncserver :$port
