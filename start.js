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

var electron = require('electron')
var path = require('path')
var argv = require('yargs').argv
var updates = require('./lib/updates.js')


// check for and perform an update if there is one
electron.app.on('ready', function () {
  if (argv.filename) {
    require(argv.filename)
    return
  }

  try {
    updates.check(finishedCheck)
  } catch (e) {
    require('./main.js')
    return
  }
  //return require('./main.js')
})


function finishedCheck() {
  try {
    var updatemain = path.join(electron.app.getPath('appData'), 'PiBakery/app/main.js')
    require(updatemain)
    return
  } catch (e) {
    // if we can't run the update, proceed as normal
    require('./main.js')
    return
  }
}
