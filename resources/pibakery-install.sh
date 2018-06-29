#!/PiBakery/busybox sh

# define the commands
cd /

bb="/PiBakery/busybox"

cp="$bb cp"
rm="$bb rm"
echo="$bb echo"
mv="$bb mv"
ln="$bb ln"
ls="$bb ls"
sleep="$bb sleep"


# copy files needed by both full and lite Raspbian
$cp /PiBakery/pibakery-raspbian/etc/systemd/system/pibakery.service /root/etc/systemd/system/pibakery.service
$ln -s /root/etc/systemd/system/pibakery.service /root/etc/systemd/system/multi-user.target.wants/pibakery.service
$echo "copied global service files"
$echo "02globalservice" >> /log.txt

$cp -r /PiBakery/pibakery-raspbian/opt /root/
$echo "copied /opt/ directory"
$echo "03optdir" >> /log.txt

if [ -f /root/lib/systemd/system/lightdm.service ]
then
  # this is Raspbian Full
  $rm /root/lib/systemd/system/lightdm.service
  $cp /PiBakery/pibakery-raspbian/lib/systemd/system/lightdm.service /root/lib/systemd/system/lightdm.service
  $echo "copied Raspbian Full files"
  $echo "04Araspbianfull" >> /log.txt
else
  # this is Raspbian Lite
  $rm /root/opt/PiBakery/console.sh
  $mv /root/opt/PiBakery/console-lite.sh /root/opt/PiBakery/console.sh
  $echo "copied Raspbian Lite files"
  $echo "04Braspbianlite" >> /log.txt
fi

$echo "Finished Installing PiBakery"
$echo "05finished" >> /log.txt

exit 0
