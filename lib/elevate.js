/*
 * Copyright 2016 Resin.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License")
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict'

var electron = require('electron')
var isElevated = require('is-elevated')
var sudoPrompt = require('sudo-prompt')
var os = require('os')
var platform = os.platform()
var packageJSON = require('../package.json')
var path = require('path')

exports.require = function (additionalArguments, callback) {
  isElevated(function (error, elevated) {
    if (error) {
      return callback(error)
    }

    if (elevated) {
      return callback()
    }

    // copy the args and add in the additional arguments
    var args = process.argv.slice()
    for (var i = 0; i < additionalArguments.length; i++) {
      args.push(additionalArguments[i])
    }

    // case split for unix and windows
    if (platform === 'darwin' || platform === 'linux') {

      sudoPrompt.exec(args.join(' '), {
        name: packageJSON.displayName,
        icns: path.join(__dirname, '../app/img/icon.icns')
      }, callback)

    } else if (platform === 'win32') {

      const elevator = require('elevator')
      elevator.execute(args, {}, callback)

    }
  })
}
