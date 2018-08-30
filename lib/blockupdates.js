/*
 * PiBakery 2.0.0 - The easy to use setup tool for Raspberry Pi
 * Copyright (C) 2018  David Ferguson <david@pibakery.org>
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
  update: update
}


var app = require('electron').app || require('electron').remote.app
var fs = require('fs-extra')
var path = require('path')
var request = require('request')
var unzipper = require('unzipper')
var digestStream = require('digest-stream')
var settings = require('./settings.js')

var downloadCorrect = undefined
var blockDirectory = path.join(app.getPath('appData'), 'PiBakery/blocks')


function update (cb) {
  fs.mkdir(blockDirectory, function (error) {
    if (error && error.code !== 'EEXIST') {
      cb(error)
      return
    }

    settings.get('blocksources', function (error, sources) {
      if (error || sources.length === 0) {
        cb(error)
        return
      }

      updateBlockSources(sources, cb)
    })
  })
}


function updateBlockSources (sources, cb, count) {
  if (typeof count === 'undefined') {
    count = 0
  }

  if (count >= sources.length) {
    cb(null)
    return
  }

  var source = sources[count]
  var updateUrl = source.url + '?' + Math.random().toString(36).substr(2, 5)
  var infoFile = path.join(blockDirectory, source.name, 'info.json')

  // get the update json file
  request(updateUrl, {json: true}, function (error, response, body) {
    if (error) {
      updateBlockSources(sources, cb, (count + 1))
      return
    }

    // read te local json file
    fs.readFile(infoFile, 'utf8', function (error, data) {
      if (error && error.code !== 'ENOENT') {
        updateBlockSources(sources, cb, (count + 1))
        return
      }

      if (error && error.code === 'ENOENT') {
        // if no such local file exists, set the data to version 0 to force an update
        data = { version: 0.0 }
      }

      // see if there's an update
      var updateVersion = body.version
      var currentVersion = data.version
      if (updateVersion <= currentVersion) {
        // no update available, go to next block
        updateBlockSources(sources, cb, (count + 1))
        return
      }

      // there is an update available, perform it
      updateSource(body, source, function (error) {
        updateBlockSources(sources, cb, (count + 1))
        return
      })
    })
  })
}


function updateSource (updateJson, settingJson, cb) {
  var savename = path.join(blockDirectory, settingJson.name)
  var url = updateJson.downloadUrl + '?' + Math.random().toString(36).substr(2, 5)

  // first delete the current directory
  fs.remove(savename, function (error) {
    if (error && error.code !== 'ENOENT') {
      cb()
      return
    }

    // now perform the download
    request.get(url)

    // check the hash of the tar file
    .pipe(digestStream('md5', 'hex', function (hash, length) {
      downloadCorrect = (hash === updateJson.compressedMD5)
    }))

    // extract the file
    .pipe(unzipper.Extract({ path: blockDirectory }))

    // call downloadComplete when it's done
    .promise()
    .then(function () {
      downloadComplete(updateJson, settingJson, cb)
    }, cb)
  })
}


// called when download is complete
function downloadComplete (updateJson, settingJson, cb) {
  // if not calculated yet, re-run in 1 second
  if (downloadCorrect === 'undefined') {
    setTimeout(function () {
      downloadComplete(updateJson, settingJson, cb)
    }, 1000)
    return
  }

  // check download hash matched correctly
  if (!downloadCorrect) {
    cb()
    return
  }

  // get the name the zip extracted to
  var extractName = 'pibakery-blocks-new'
  if ('extract' in updateJson) {
    extractName = updateJson.extract
  }

  // where we are moving from and to
  var source = path.join(blockDirectory, extractName)
  var target = path.join(blockDirectory, settingJson.name)

  // move the downloaded directory to the target directory
  fs.move(source, target, {overwrite: true}, function (error) {
    if (error) {
      cb()
      return
    }

    cb()
  })
}
