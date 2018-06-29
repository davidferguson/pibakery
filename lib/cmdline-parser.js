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
  parse: parse,
  write, write,
  get, get,
  set, set
}

var fs = require('fs-extra')
var childProcess = require('child_process')

var parsed = []


// parse a given cmdline.txt file
function parse (filename, cb) {
  // reset the variables
  parsed = []

  // read the cmdline.txt file
  fs.readFile(filename, 'utf8', function readComplete (error, contents) {
    if (error) {
      cb(error)
      return
    }

    // now parse the file into paramaters and attributes
    contents = contents.trim()
    contents = contents.split(' ')
    for (var i = 0; i < contents.length; i++) {

      // special case for non key-values, just keys
      if (contents[i].indexOf('=') == -1) {
        var obj = {
          key: contents[i],
          value: null
        }
        parsed.push(obj)
        continue
      }

      // loop through all key-value pairs
      var pair = contents[i].split(/=/)
      var key = pair.shift()
      var value = pair.join('=')

      var obj = {
        key: key,
        value: value
      }

      parsed.push(obj)
    }

    cb(null)
  })
}


// write out the (probably modified) contents of parsed to new cmdline.txt file
function write (filename, cb) {
  var pairs = []

  // loop through all pairs, combining them into a string
  for (var i = 0; i < parsed.length; i++) {
    var key = parsed[i].key
    var value = parsed[i].value

    var pair = key
    if (value) {
      pair = key + '=' + value
    }
    pairs.push(pair)
  }

  // join all pairs together as string, and write them to file
  var contents = pairs.join(' ').trim()
  fs.writeFile(filename, contents, 'utf8', function writeComplete (error) {
    if (error) {
      cb(error)
      return
    }

    // file was written successfully
    cb(null)
  })
}


// retrieve a paramater
function get (paramater) {
  for (var i = 0; i < parsed.length; i++) {
    if (parsed[i].key == paramater) {
      return parsed[i].value
    }
  }

  return ''
}


// set a paramater
function set (paramater, value) {
  for (var i = 0; i < parsed.length; i++) {
    if (parsed[i].key == paramater) {
      parsed[i].value = value
      return
    }
  }

  var obj = {
    key: paramater,
    value: value
  }
  parsed.push(obj)
}
