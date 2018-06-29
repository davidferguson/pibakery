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

// Used to make copying of multiple files to multiple destinations easy

module.exports = {
  copy: copy,
  write: write,
  exists: exists
}

var fs = require('fs-extra')


function copy (files, cb, count) {
  if (typeof count === 'undefined') {
    count = 0
  }

  if (count == files.length) {
    cb()
    return
  }

  var source = files[count].source
  var destination = files[count].destination
  fs.copy(source, destination, function (error) {
    if (error) {
      cb(error)
      return
    }

    // do we need to set file permissions for this file?
    if ('chmod' in files[count]) {
      fs.chmod(destination, files[count].chmod, function (error) {
        if (error) {
          cb(error)
          return
        }

        // permissions set fine, copy next file
        copy(files, cb, count + 1)
      })
    } else {
      // that file copied fine, go and copy the next one
      copy(files, cb, count + 1)
    }
  })
}


function write (files, cb, count) {
  if (typeof count === 'undefined') {
    count = 0
  }

  if (count == files.length) {
    cb()
    return
  }

  var file = files[count].file
  var contents = files[count].contents

  // delete the file if it exists
  fs.remove(file, function (error) {
    if (error) {
      // for some reason we don't get an error if the file doesn't exist, so we
      // don't need to check for that condition
      cb(error)
      return
    }

    // now write the file
    fs.writeFile(file, contents, function (error) {
      if (error) {
        cb(error)
        return
      }

      // do we need to set file permissions for this file?
      if ('chmod' in files[count]) {
        fs.chmod(file, files[count].chmod, function (error) {
          if (error) {
            cb(error)
            return
          }

          // permissions set fine, write next file
          write(files, cb, count + 1)
        })
      } else {
        // that file wrote fine, go and write the next one
        write(files, cb, count + 1)
      }
    })
  })
}


function exists (files, cb, count, result) {
  if (typeof count === 'undefined') {
    count = 0
  }

  if (typeof result === 'undefined') {
    result = []
  }

  if (count == files.length) {
    cb(null, result)
    return
  }

  var file = files[count]
  fs.stat(file, function (error) {
    if (error && error.code != 'ENOENT') {
      cb(error)
      return
    }

    if (!error) {
      // file exists
      result.push(file)
    }

    // process next file
    exists(files, cb, count + 1, result)
  })
}
