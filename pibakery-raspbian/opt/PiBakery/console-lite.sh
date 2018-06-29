#!/bin/bash

# this file is used on Rapsbian Lite, as it incorrectly reports that it is using "graphical.target" rather than "multi-user.target"
# basically we just ignore the checks and run it anyway

#DEFAULT=$(systemctl get-default)

#if [ $DEFAULT == "multi-user.target" ]
#then
/opt/PiBakery/startup.sh
#fi
exit 0
