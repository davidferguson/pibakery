/*
 * PiBakery 2.0.0 - The easy to use setup tool for Raspberry Pi
 * Copyright (C) 2019  David Ferguson <david@pibakery.org>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict'

module.exports = {
  write: write,
  getSDs: getSDs,
  getRaspbianSDs: getRaspbianSDs,
  getPiBakerySDs: getPiBakerySDs,
  getRemountPath, getRemountPath,
  installPiBakery, installPiBakery,
  cleanup: cleanup
}

var isElevated = require('is-elevated')
var drivelist = require('drivelist')
var path = require('path')
var imageWrite = require('etcher-image-write')
var fs = require('fs-extra')
var childProcess = require('child_process')
var kpartx = require('./kpartx.js')
var multifs = require('./multifs.js')
var cmdlineParser = require('./cmdline-parser.js')

// variable to hold whether we have used kpartx or not
var usedKpartx = false


function write (imagePath, drive, cb) {
  isElevated(function (error, elevated) {
    if (error) {
      cb.error(error)
      return
    }

    if (elevated) {
      // if already elevated, we can just call rootwriter.doWrite
      var rootwriter = require('./rootwriter.js')
      rootwriter.doWrite(imagePath, drive, {
        validate: false
      }, cb)
    } else {
      // if not elevated, we need to do the complex elevation of the writer thread
      nonRootWrite(imagePath, drive, cb)
    }
  })
}


function nonRootWrite (imagePath, drive, cb) {
  // electron ipc
  var ipcElectron = require('electron').ipcRenderer

  // create the ipc server
  var ipc = require("crocket")
  var server = new ipc();

  var jsonDrive = JSON.stringify(drive)

  // bash escape the arguments, if on mac or linux
  if (process.platform !== 'win32') {
    imagePath = bashEscape(imagePath)
    jsonDrive = bashEscape(jsonDrive)
  }

  // create random socket path
  var socketPath = '/tmp/' + Math.random().toString(36).substr(2, 5) + '.sock'

  // setup the ipc server
  server.listen({
    path: socketPath
  }, function (error) {
    if (error) {
      cb.error(error)
      return
    }

    // now that server has been created, spawn root thread
    ipcElectron.send('rootwriter', imagePath, jsonDrive, socketPath)
  })

  server.on('write-progress', function (state) {
    state = JSON.parse(state)
    cb.progress(state)
  })

  server.on('write-error', function (error) {
    error = JSON.parse(error)
    cb.error(error)
  })

  server.on('write-done', function (state) {
    state = JSON.parse(state)
    cb.done(state, drive)
  })
}

function bashEscape (arg) {
  // Thanks to creationix on GitHub
  var safePattern = /^[a-z0-9_\/\-.,?:@#%^+=\[\]]*$/i
  var safeishPattern = /^[a-z0-9_\/\-.,?:@#%^+=\[\]{}|&()<>; *']*$/i
  if (safePattern.test(arg)) {
    return arg
  }
  if (safeishPattern.test(arg)) {
    return '"' + arg + '"'
  }
  return "'" + arg.replace(/'+/g, function (val) {
    if (val.length < 3) {
      return "'" + val.replace(/'/g, "\\'") + "'"
    }
    return '\'"' + val + '"\''
  }) + "'"
}

/*function write (imagePath, drive, options, cb) {
  unmount(drive, function (error) {
    if (error) {
      error.guimsg = 'Error writing to SD card'
      cb.error(error)
      return
    }
    beginWrite(imagePath, drive, options, cb.progress, cb.error, cb.done)
  })
}

function beginWrite (imagePath, drive, options, onProgress, onError, onDone) {
  fs.open(drive.raw, 'rs+', function (error, driveFileDescriptor) {
    if (error) {
      error.guimsg = 'Error opening .img for reading'
      onError(error)
      return
    }

    fs.stat(imagePath, function (error, stats) {
      if (error) {
        error.guimsg = 'Error reading stats of .img file'
        onError(error)
        return
      }

      // check the sd card is large enough for the chosen image
      if (drive.size < stats.size) {

        var msg = 'The chosen device is not large enough for the chosen image. '
        msg = msg + 'Device: ' + drive.device
        msg = msg + '. Image: ' + imagePath

        var error = new Error('drive too small')
        error.name = 'SD_TOO_SMALL'
        error.guimsg = msg
        onError(error)
        return
      }

      var writer = imageWrite.write({
        fd: driveFileDescriptor,
        device: drive.raw,
        size: drive.size
      }, {
        stream: fs.createReadStream(imagePath),
        size: stats.size
      }, {
        check: options.check
      })

      writer.on('progress', onProgress)
      writer.on('error', function (error) {
        error.guimsg = 'Error during SD write'
        onError(error)
      })

      writer.on('done', function (state) {
        fs.close(driveFileDescriptor, function (error) {
          if (error) {
            error.guimsg = 'Error closing drive file descriptor'
            onError(error)
            return
          }
          onDone(state, drive)
        })
      })
    })
  })
}

function unmount (drive, cb) {
  var unmountCommand = ''
  if (process.platform === 'darwin') {
    unmountCommand = '/usr/sbin/diskutil unmountDisk force ' + drive.device
  } else if (process.platform === 'linux') {
    unmountCommand = 'umount ' + drive.device + '?* 2>/dev/null || /bin/true'
  } else {
    cb(false)
    return
  }

  childProcess.exec(unmountCommand, function (error, stdout, stderr) {
    if (error) {
      error.guimsg = 'Error unmounting drive'
      cb(error)
      return
    }
    cb(false)
  })
}*/

function getSDs (cb) {
  drivelist.list(function (error, drives) {
    if (error) {
      cb(error, false)
      return
    }

    var sdCards = []
    for (var i = 0; i < drives.length; i++) {
      var currentDrive = drives[i]
      if (!currentDrive.system && !currentDrive.protected) {
        currentDrive.name = getDriveName(currentDrive)
        if (currentDrive.name) {
          sdCards.push(currentDrive)
        }
      }
    }

    cb(false, sdCards)
  })
}


function getDriveName (drive) {
  if (process.platform === 'darwin' || process.platform === 'linux') {
    if (drive.mountpoints.length < 1) {
      return false
    }
    return path.basename(drive.mountpoints[0].path)
  }
  if (process.platform === 'win32') {
    return drive.displayName
  }
}


function getRaspbianSDs (cb) {
  getSDs(function (error, sds) {
    if (error) {
      cb(error)
      return
    }

    // loop through drives, seeing if they're Raspbian ones
    loopThroughDrives(sds, 'bootcode.bin', cb)
  })
}


function getPiBakerySDs (cb) {
  getSDs(function (error, sds) {
    if (error) {
      cb(error)
      return
    }

    // loop through drives, seeing if they're Raspbian ones
    loopThroughDrives(sds, 'PiBakery/blocks.xml', cb)
  })
}


function loopThroughDrives(drives, file, cb, driveCount, mountpointCount, results) {
  if (typeof driveCount === 'undefined') {
    driveCount = 0
  }
  if (typeof mountpointCount === 'undefined') {
    mountpointCount = 0
  }
  if (typeof results === 'undefined') {
    results = []
  }

  // see if we are finished
  if (driveCount >= drives.length) {
    cb(null, results)
    return
  }

  var drive = drives[driveCount]

  // see if we should move onto the next drive
  if (mountpointCount >= drive.mountpoints.length) {
    driveCount++
    mountpointCount = 0
    loopThroughDrives(drives, file, cb, driveCount, mountpointCount, results)
  }

  // check the current loop file
  var fileToCheck = path.join(drive.mountpoints[mountpointCount].path, file)
  fs.stat(fileToCheck, function (error, stat) {
    if (!error) {
      // we can read this file, add it to results
      results.push(drive)

      // skip other mountpoints - go to next drive
      driveCount++
      mountpointCount = 0
    } else {
      mountpointCount++
    }

    loopThroughDrives(drives, file, cb, driveCount, mountpointCount, results)
  })
}


function getRemountPath (drive, cb) {
  // (mac and windows) differ from other unixy platforms
  if (process.platform === 'darwin' || process.platform === 'win32') {
    getRemountPathMacWindows(drive, 0, false, cb)
  } else if (process.platform === 'linux' ||
             process.platform === 'freebsd' ||
             process.platform === 'openbsd') {
    getRemountPathUnix(drive, 0, false, cb)
  }
}

function getRemountPathMacWindows (drive, count, mounted, cb) {
  regetDrive(drive, function (error, drive) {
    if (error) {
      cb(error)
      return
    }

    // if function has been called more than 12 times (1 min), return an error
    if (count > 12) {
      // message if the drive didn't remount
      var msg = 'The device did not remount automatically. '
      msg = msg + 'No attempt was made to remount the device manually. '

      // different message if it mounted, but couldn't read bootcode.bin
      if (mounted) {
        msg = 'The device remounted, but bootcode.bin could not be read. '
      }
      msg = msg + 'Device: ' + drive.device

      var error = new Error('Error getting remount path - count exceeded')
      error.name = 'DID_NOT_REMOUNT'
      error.guimsg = msg

      cb(error)
      return
    }

    // if there is more than one mountpoint, return an error
    if (drive.mountpoints.length > 1) {
      var msg = 'There is more than one mountpoint. '
      msg = msg + 'Device: ' + drive.device
      msg = msg + '. Mountpoints: ' + JSON.stringify(drive.mountpoints)

      var error = new Error('Error getting single mountpoint')
      error.name = 'TOO_MANY_MOUNTPOINTS'
      error.guimsg = msg

      cb(error)
      return
    }

    // if not mounted yet, run this function again
    if (drive.mountpoints.length == 0) {
      setTimeout(function() {
        getRemountPathMacWindows(drive, count + 1, false, cb)
      }, 5000)
      return
    }

    // see if it has been remounted. The file we're checking for is bootcode.bin
    var mountpoint = drive.mountpoints[0].path
    var bootcodefile = path.join(mountpoint, 'bootcode.bin')
    fs.stat(bootcodefile, function (error, stats) {
      if (error) {
        // can't read bootcode.bin - run this function again
        setTimeout(function() {
          getRemountPathMacWindows(drive, count + 1, true, cb)
        }, 5000)
        return
      }

      // no error reading file, therefore drive is mounted
      cb(null, mountpoint)
    })
  })
}


function regetDrive (drive, cb) {
  // update drive
  drivelist.list(function (error, drives) {
    if (error) {
      cb(error)
      return
    }

    // find our drive in the list
    for (var i = 0; i < drives.length; i++) {
      if (drives[i].device === drive.device) {
        drive = drives[i]
      }
    }

    cb(null, drive)
  })
}


// the unix function differs from the mac and windows one as unix systems may
// not always remount the device after writing, so we need to attempt a manual
// mount if necessary. linux can also read the ext4 partition, so there will
// likely be multiple mountpoints when/if the partition is auto-mounted
function getRemountPathUnix (drive, count, mounted, cb) {
  regetDrive(drive, function (error, drive) {
    if (error) {
      cb(error)
      return
    }

    // if function has been called more than 2 times (10 sec), attempt manualmount
    if (count > 2) {
      if (!mounted) {
        // attempt manual remount if the drive didn't remount
        beginManualMount(drive, cb)
        return
      }

      // callback error if it did mount, but couldn't read bootcode.bin
      var msg = 'The device remounted, but bootcode.bin could not be read. '
      msg = msg + 'Device: ' + drive.device

      var error = new Error('Error getting single mountpoint')
      error.name = 'TOO_MANY_MOUNTPOINTS'
      error.guimsg = msg
      cb(error)
      return
    }

    // if not mounted yet, run this function again
    if (drive.mountpoints.length == 0) {
      setTimeout(function() {
        getRemountPathUnix(drive, count + 1, false, cb)
      }, 5000)
      return
    }

    // see if it has been remounted. The file we're checking for is bootcode.bin.
    // on unix, we can have multiple mountpoints so we need to check them all
    checkMountpointsUnix(drive, count, 0, cb)
  })
}

// try and manually mount the drive using kpartx
function beginManualMount (drive, cb) {
  kpartx.isInstalled(function(result) {
    if (!result) {
      var msg = 'The system does not have kpartx installed. '
      msg = msg + 'Please install kpartx and try again'

      var error = new Error('kpartx is not installed')
      error.name = 'MISSING_KPARTX'
      error.guimsg = msg

      cb(error)
      return
    }

    // system has kpartx, we can proceed with the manual mount
    kpartx.addPartitionMappings(drive.device, function (error, maps) {
      // necessary as we want to pass 'drive' to the callback function
      mappingsMounted(error, maps, drive, cb)
    })
  })
}

function mappingsMounted (error, maps, drive, cb) {
  if (error) {
    error.guimsg = 'Error adding kpartx mappings'
    cb(error)
    return
  }

  // mappings have been created, mount 0 is the /boot partition
  var map = '/dev/mapper/' + maps[0].map

  // create a random path to use for mounting the directory
  var randomString = Math.random().toString(36).substring(2,7)
  var mountpoint = '/tmp/pibakeryboot' + randomString

  // create the mount directory
  fs.mkdir(mountpoint, function (error) {
    if (error) {
      error.guimsg = 'Error creating directory for manual mount'
      cb(error)
      return
    }

    // mount the device
    childProcess.execFile('mount', [map, mountpoint], function (error, stdout, stderr) {

      if (error) {
        // attempt to handle errors - want to try and delete the kpartx mappings
        kpartx.deletePartitionMappings(drive.device, function (kpartxError) {
          // an error whilst processing an error?
          /*var msg = ''
          if ('nam' in error) {
            msg = error.name
          }
          var name = error.message
          if (kpartxError) {
            // add the two errors together
            name = name + '.' + kpartxError.name

            // create the more informative message
            msg = msg + '.' + kpartxError.message
            msg = msg + '. An attempt was made to remove the kpartx mappings but\
            this was unsuccessful. Please remove the mappings manually.'
            msg = msg + ' Device: ' + drive
            msg = msg + ', Mountpoint: ' + mountpoint
            msg = msg + ', Mapping: ' + map
          }*/

          // callback the error
          var error = new Error('')
          error.name = name
          cb(error)
          return
        })
        // stop the control flow
        return
      }

      // set global flag (so we know to unmount and delete mappings)
      usedKpartx = true

      // mount was successful, callback the mountpoint
      cb(null, mountpoint)
    })
  })
}


function checkMountpointsUnix (drive, remountCount, checkCount, cb) {
  // if we've checked all mountpoints, run the parent function again
  if (checkCount >= drive.mountpoints.length) {
    setTimeout(function() {
      getRemountPathUnix(drive, remountCount + 1, true, cb)
    }, 5000)
    return
  }

  // check the current mountpoint
  var mountpoint = drive.mountpoints[checkCount].path
  var bootcodefile = path.join(mountpoint, 'bootcode.bin')
  fs.stat(bootcodefile, function (error, stats) {
    if (error) {
      // can't read bootcode.bin - run this function again
      setTimeout(function() {
        checkMountpointsUnix(drive, remountCount, checkCount + 1, cb)
      }, 5000)
      return
    }

    // no error reading file, therefore drive is mounted
    cb(null, mountpoint)
  })
}


function installPiBakery (mountpoint, data, cb) {
  cb.progress({text:'Creating directories...'})
  createPiBakeryDirectory(mountpoint, function (error) {
    if (error) {
      cb.error(error)
      return
    }

    cb.progress({text:'Modifying cmdline.txt...'})
    modifyCmdlineTxt(mountpoint, function (error) {
      if (error) {
        cb.error(error)
        return
      }

      cb.progress({text:'Writing boot scripts...'})
      writeBootScripts(mountpoint, data, function (error) {
        if (error) {
          cb.error(error)
          return
        }

        cb.done()
      })
    })
  })
}


function createPiBakeryDirectory (mountpoint, cb) {
  var pibakeryDir = path.join(mountpoint, 'PiBakery')
  fs.mkdir(pibakeryDir, function (error) {
    // ignore errors about the directory already existing
    if (error && error.code != 'EEXIST') {
      cb(error)
      return
    }

    cb(null)
  })
}


// the drive has been mounted, now write the scripts to it
function writeBootScripts (mountpoint, data, cb) {
  // write scripts, and then unmount and remove kpartx mappings if necessary
  var files = [
    {
      source: path.join(__dirname, '../resources/busybox'),
      destination: path.join(mountpoint, 'PiBakery/busybox')
    },
    {
      source: path.join(__dirname, '../resources/pibakery-mount.sh'),
      destination: path.join(mountpoint, 'PiBakery/pibakery-mount.sh')
    },
    {
      source: path.join(__dirname, '../resources/pibakery-install.sh'),
      destination: path.join(mountpoint, 'PiBakery/pibakery-install.sh')
    },
    {
      source: path.join(__dirname, '../pibakery-raspbian'),
      destination: path.join(mountpoint, 'PiBakery/pibakery-raspbian')
    }
  ]

  // convert the data object into blocks to copy
  var blocks = data.blocks
  var blockPaths = data.blockPaths
  for (var i = 0; i < blockPaths.length; i++) {
    var source = blockPaths[i]
    var destination = path.join(mountpoint, 'PiBakery/blocks/', blocks[i])
    var file = {
      source: source,
      destination: destination
    }
    files.push(file)
  }

  multifs.copy(files, function (error) {
    if (error) {
      cb(error)
      return
    }

    // all files copied successfully, now write the boot scripts
    files = [
      {
        file: path.join(mountpoint, 'PiBakery/everyBoot.sh'),
        contents: data.everyBoot
      },
      {
        file: path.join(mountpoint, 'PiBakery/firstBoot.sh'),
        contents: data.firstBoot
      },
      {
        file: path.join(mountpoint, 'PiBakery/nextBoot.sh'),
        contents: data.nextBoot
      },
      {
        file: path.join(mountpoint, 'PiBakery/blocks.xml'),
        contents: data.xml
      },
      {
        file: path.join(mountpoint, 'PiBakery/runFirstBoot'),
        contents: ''
      },
      {
        file: path.join(mountpoint, 'PiBakery/runNextBoot'),
        contents: ''
      }
    ]

    // convert waitForNetwork into the touch files
    var waitForNetwork = data.waitForNetwork
    var fileNames = ['EveryBoot', 'FirstBoot', 'NextBoot']
    for (var i = 0; i < 3; i++) {
      if (waitForNetwork[i]) {
        var name = 'waitForNetwork' + fileNames[i]
        var file = {
          file: path.join(mountpoint, 'PiBakery/', name),
          contents: ''
        }
        files.push(file)
      }
    }

    // write all the files
    multifs.write(files, cb)
  })
}


function modifyCmdlineTxt (mountpoint, cb) {
  // move /cmdline.txt to /PiBakery/cmdline.txt.original
  var source = path.join(mountpoint, 'cmdline.txt')
  var destination = path.join(mountpoint, 'PiBakery/cmdline.txt.original')

  // only do this if /PiBakery/cmdline.txt.original doesn't already exist
  fs.stat(destination, function (error, stats) {
    if (error && error.code != 'ENOENT') {
      cb(error)
      return
    }

    // if it exists, exit without doing anything
    var exists = !error
    if (exists) {
      cb(null)
      return
    }

    // if it doesn't exist, move the file
    fs.copy(source, destination, {overwrite: true}, function moveComplete (error) {
      if (error) {
        cb(error)
        return
      }

      // write the new cmdline.txt
      cmdlineParser.parse(destination, function (error) {
        if (error) {
          cb(error)
          return
        }

        cmdlineParser.set('root', '/dev/mmcblk0p1')
        cmdlineParser.set('rootfstype', 'vfat')
        cmdlineParser.set('rootflags', 'umask=000')
        cmdlineParser.set('init', '/PiBakery/pibakery-mount.sh')

        cmdlineParser.write(source, cb)
      })
    })
  })
}


function cleanup (drive, mountpoint, cb) {
  if (process.platform !== 'linux' || !usedKpartx) {
    cb(null, drive)
    return
  }

  // unmount the mountpoint
  childProcess.execFile('umount', [mountpoint], function (error, stdout, stderr) {
    if (error) {
      cb(error)
      return
    }

    // remove the mountpoint
    fs.remove(mountpoint, function (error) {
      if (error) {
        cb(error)
        return
      }

      // delete the kpartx mappings
      kpartx.deletePartitionMappings(drive.device, function (error) {
        if (error) {
          cb(error)
          return
        }

        // cleaned up successfully
        cb(null, drive)
        return
      })
    })
  })
}
