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
  get: get,
  set: set
}

var app = require('electron').app || require('electron').remote.app
var path = require('path')
var fs = require('fs-extra')


var settings = {}


// get the proper settings file
var settingsFile = path.join(app.getPath('appData'), 'PiBakery/settings.json')
var hardSettingsFile = path.join(__dirname, '../settings.json')
var exists = fs.existsSync(settingsFile)

// if settings file doesn't exist, try and create it
if (!exists) {
  try {
    fs.copySync(hardSettingsFile, settingsFile)
  } catch (e) {
    // if error on copying, revert back to hard settings file
    settingsFile = hardSettingsFile
  }
}


function load (cb) {
  fs.readJson(settingsFile, function (error, data) {
    if (error) {
      cb(error)
      return
    }

    settings = data
    cb(null)
  })
}


function save (cb) {
  // don't modify the in-app settings file
  if (settingsFile === hardSettingsFile) {
    return
  }

  try {
    var data = JSON.stringify(settings, null, 2) // save with pretty printing
  } catch (e) {
    cb(e)
    return
  }

  fs.writeFile(settingsFile, data, function (error) {
    if (error) {
      cb(error)
      return
    }

    cb(null)
  })
}


function get (setting, cb) {
  load(function (error) {
    if (error) {
      cb(error)
      return
    }

    if (! settings.hasOwnProperty(setting)) {
      cb(null, undefined)
      return
    }

    cb(null, settings[setting])
  })
}


function set (setting, value, cb) {
  load(function (error) {
    if (error) {
      cb(error)
      return
    }

    settings[setting] = value

    save(cb)
  })
}
