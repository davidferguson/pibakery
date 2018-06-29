#!/PiBakery/busybox sh

# pibakery-install.sh - Fat32 installer for PiBakery

# Copyright 2018 sysvinit (https://github.com/sysvinit)
#
# Permission to use, copy, modify, and/or distribute this software for any
# purpose with or without fee is hereby granted, provided that the above
# copyright notice and this permission notice appear in all copies.
#
# THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
# WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
# MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
# ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
# WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
# ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
# OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.


# Busybox provides *ALL* of our commands, but is *not* symlinked, so set
# up aliases for the commands we need

cd /

bb="/PiBakery/busybox"

mount="$bb mount"
umount="$bb umount"
mkdir="$bb mkdir"
mknod="$bb mknod"
sync="$bb sync"
cat="$bb cat"
cp="$bb cp"
rm="$bb rm"
rmdir="$bb rmdir"
reboot="$bb reboot"
sleep="$bb sleep"
echo="$bb echo"
mv="$bb mv"

# Mount root filesystem as writable, then create a tmpfs directory in which we
# can create the device nodes we need to access the root partition
$mount -o remount,rw / / # Two slashes are essential!
$mkdir /tmp
$mkdir /root
$mount -t tmpfs tmpfs /tmp

# Access the root fs
$mknod /tmp/mmcblk0p2 b 179 2
$mount -o rw -t ext4 /tmp/mmcblk0p2 /root

# now /boot and /root are mounted, we can run the installer
/PiBakery/pibakery-install.sh

# Sync and unmount root fs
$sync
$umount /root
$rmdir /root

# Remove device node and tmp dir
$rm /tmp/mmcblk0p2
$umount /tmp
$rmdir /tmp

# Reset cmdline.txt back to the original version
$rm -f /cmdline.txt
$mv -f /PiBakery/cmdline.txt.original /cmdline.txt

# Sync filesystems, mount read-only, and reboot
$sync
$mount -o remount,ro /
$sync

$sleep 2
$reboot -f
