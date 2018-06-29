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

// runs as root to write the sd cards

module.exports = {
  connect: connect,
  write: write,
  doWrite: doWrite
}

var electron = require('electron')
var imageWrite = require('etcher-image-write')
var fs = require('fs-extra')
var childProcess = require('child_process')
var ipc = require("crocket")
var client = new ipc()


function connect (socketPath, cb) {
  client.connect({
    path: socketPath
  }, function (error) {
    if (error) {
      throw error
    }

    // connected successfully
    cb()
  })
}


function write (imagePath, drive, cb) {
  doWrite(imagePath, drive, {
    validate: false
  }, {
    progress: writeImageProgress,
    error: function (error) {
      writeImageError(error)
      client.close()
      cb()
    },
    done: function (state, drive) {
      writeImageDone(state, drive)
      client.close()
      cb()
    }
  })
}


function writeImageProgress (state) {
  // send message to the client
  client.emit('write-progress', JSON.stringify(state))
}

function writeImageError (error) {
  client.emit('write-error', JSON.stringify(error))
}

function writeImageDone (state, drive) {
  client.emit('write-done', JSON.stringify(state))
}


function doWrite (imagePath, drive, options, cb) {
  cb.progress({text:'Unmounting SD card...'})
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
  onProgress({text:'Preparing for write...'})
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

      onProgress({text:'Writing IMG to SD card...'})

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
}
