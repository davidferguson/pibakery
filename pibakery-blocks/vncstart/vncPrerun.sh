#!/bin/bash

chmod +x /boot/PiBakery/blocks/vncstart/vncRun.sh
#su - pi -c "/boot/PiBakery/blocks/vncstart/vncRun.sh $@"
exec sudo -u pi -- "/boot/PiBakery/blocks/vncstart/vncRun.sh" "$@"
