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
  check: check
}

var path = require('path')
var electron = require('electron')
var request = require('request')
var unzipper = require('unzipper')
var digestStream = require('digest-stream')
var fs = require('fs-extra')
var semver = require('semver')
var settings = require('./settings.js')

var downloadCorrect = undefined


function check (cb) {
  // prevent caching by adding random query on end of url
  var updateUrl = 'http://pibakery.org/updates/app.json' + '?' + Math.random().toString(36).substr(2, 5)
  
  request(updateUrl, {json: true}, function (error, response, body) {
    if (error) {
      cb()
      return
    }

    // get the current version
    settings.get('version', function (error, currentVersion) {
      if (error) {
        cb()
        return
      }

      // see if this update is greater
      var updateVersion = body.version
      var shouldUpdate = semver.gt(updateVersion, currentVersion)

      if (!shouldUpdate) {
        cb()
        return
      }

      // we need to perform the update
      update(body, cb)
    })
  })
}


function update (data, cb) {
  console.log('performing update')
  var savename = path.join(electron.app.getPath('appData'), 'PiBakery/')
  var url = data.url + '?' + Math.random().toString(36).substr(2, 5)
  var correctHash = data.sha256
  var extractName = data.extract

  // first delete the current directory
  fs.remove(path.join(savename, 'app'), function (error) {
    if (error) {
      cb()
      return
    }

    // now perform the download
    request.get(url)

    // check the hash of the tar file
    .pipe(digestStream('sha256', 'hex', function (hash, length) {
      downloadCorrect = (hash === correctHash)
      console.log('downloadcorrect', downloadCorrect)
    }))

    // extract the file
    .pipe(unzipper.Extract({ path: savename }))

    // call downloadComplete when it's done
    .promise()
    .then(function () {
      downloadComplete(data, cb)
    }, cb)
  })
}


// called when download is complete
function downloadComplete (data, cb) {
  console.log('downloadComplete')
  if (downloadCorrect === 'undefined') {
    setTimeout(function () {
      downloadComplete(data, cb)
    }, 1000)
    return
  }

  // check download hash matched correctly
  if (!downloadCorrect) {
    cb()
    return
  }

  var source = path.join(electron.app.getPath('appData'), 'PiBakery/', data.extract)
  var target = path.join(electron.app.getPath('appData'), 'PiBakery/app')

  // move the downloaded directory to the target directory
  fs.move(source, target, {overwrite: true}, function (error) {
    if (error) {
      cb()
      return
    }

    console.log('move complete')

    // make the symlink
    symlink(function (error) {
      if (error) {
        cb()
        return
      }

      updateVersionNumber(data, cb)
    })
  })
}


function symlink (cb) {
  console.log('symlink making...')
  // setup the symlink
  var source = path.join(__dirname, '../node_modules')
  var target = path.join(electron.app.getPath('appData'), 'PiBakery/app/node_modules')

  fs.symlink(source, target, cb)
}


function updateVersionNumber (data, cb) {
  console.log('incrementing version number')
  var newVersion = data.version

  settings.set('version', newVersion, cb)
}
