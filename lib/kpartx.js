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
  isInstalled: isInstalled,
  addPartitionMappings, addPartitionMappings,
  deletePartitionMappings, deletePartitionMappings
}

var fs = require('fs-extra')
var childProcess = require('child_process')


// cb(true|false)
function isInstalled (cb) {
  // run command to determine if kpartx is installed
  childProcess.execFile('which', ['kpartx'], function (error, stdout, stderr) {
    if (error) {
      // if error, return false (system doesn't have kpartx)
      cb(false)
      return
    }

    // return true if there is a path to kpartx
    cb(stdout != '')
  })
}


function addPartitionMappings (device, cb) {
  // command to add mappers, with verbose output
  var cmd = 'kpartx -asv ' + device
  childProcess.execFile('kpartx', ['-asv', device], function (error, stdout, stderr) {
    if (error) {
      // if error, return error
      cb(error)
      return
    }

    // if there is content in stderr, then
    if (stderr.trim() != '') {
      var error = new Error(stderr)
      error.name = 'KPARTX_ADD_ERROR'
      cb(error)
      return
    }

    // check the stdout is as expected
    if (stdout.trim().indexOf('add map ') != 0) {
      var error = new Error('Unable to add mappings, output:' + stdout)
      error.name = 'KPARTX_ADD_ERROR'
      cb(error)
      return
    }

    // parse stdout to get the mapping paths and sizes
    var lines = stdout.split('\n')
    var maps = []
    for (var i = 0; i < lines.length; i++) {
      // loop through all the mounts
      var map = lines[i].split(' ')[2]
      var size = lines[i].split(' ')[5]

      if (map && size) {
        maps.push({
          map: map,
          size: size
        })
      }
    }

    cb(null, maps)
  })
}


function deletePartitionMappings (device, cb) {
  // command to delete mappers
  var cmd = 'kpartx -d ' + device
  childProcess.execFile('kpartx', ['-d', device], function (error, stdout, stderr) {
    if (error) {
      // if error, return error
      cb(error)
      return
    }

    // if there is content in stderr, then
    if (stderr.trim() != '') {
      var error = new Error(stderr)
      error.name = 'KPARTX_DELETE_ERROR'
      cb(error)
      return
    }

    // check stdout is as expected
    /*if (stdout.trim().indexOf('loop deleted : ') != 0) {
      var error = new Error('Unable to delete mappings, output:' + stdout)
      error.name = 'KPARTX_DELETE_ERROR'
      cb(error)
      return
    }*/

    cb(null)
  })
}
