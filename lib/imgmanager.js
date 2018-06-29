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
  getImages: getImages,
  addImage: addImage
}

var path = require('path')
var fs = require('fs-extra')
var multifs = require('./multifs.js')
var settings = require('./settings.js')


function getImages (cb) {
  // get previously used images
  settings.get('previousImages', function (error, previousImages) {
    if (error) {
      cb(error)
      return
    }

    // see how many of the previousImages still exist
    multifs.exists(previousImages, function (error, existingImages) {
      if (error) {
        cb(error)
        return
      }

      // if the array is longer than 6 elements, only give the first 6
      if (existingImages.length > 6) {
        existingImages = array.slice(0, 6);
      }

      // convert list of operatingSystems to array of objects
      var existingImagesObjects = []
      for (var i = 0; i < existingImages.length; i++) {
        var existingImage = {
          display: path.basename(existingImages[i]),
          value: existingImages[i]
        }
        existingImagesObjects.push(existingImage)
      }

      // return all the previously used images that still exist
      cb(null, existingImagesObjects)

      // save the possibly truncated esults back to settings, do nothing with callback
      settings.set('previousImages', existingImages, function () {})
    })
  })
}


function addImage (imagePath) {
  settings.get('previousImages', function (error, currentImages) {
    if (error) {
      cb(error)
      return
    }

    // append the new image
    currentImages.push(imagePath)

    // save the results back to settings, do nothing with callback
    settings.set('previousImages', currentImages, function () {})
  })
}


// OLD CODE.
/*function getOsPath () {
  if (process.platform === 'darwin') {
    // Mac stores the OS in Application Support
    return path.normalize('/Library/Application Support/PiBakery/os/')
  } else if (process.platform === 'win32' || process.platform === 'linux') {
    // Windows and Linux store the OS in install directory
    return path.join(__dirname, '/../os/')
  } else {
    return null
  }
}

function getImages (cb) {
  // get the directory that the operating systems (and images.json) are stored
  var operatingSystemDirectory = getOsPath()

  // read the images configuration file
  fs.readFile(path.join(operatingSystemDirectory, 'images.json'), 'utf8', function (error, data) {
    if (error) {
      cb(error, false)
      return
    }

    // load the json file into javascript object
    try {
      var localImagesJson = JSON.parse(data)
    } catch (error) {
      cb(error, false)
      return
    }

    // use function for loop
    loopThroughImages([], localImagesJson, 0, function installedImagesResult(error, installedImages) {
      cb(false, installedImages)
    })
  })
}

// extra function needed because we can't have callbacks in loops
function loopThroughImages(installedImages, localImagesJson, counter, cb) {
  if (counter == localImagesJson.length) {
    // end of the loop, return the result
    cb(null, installedImages)
    return
  }

  var operatingSystemDirectory = getOsPath()

  // see if a specific image is installed (index counter)
  localImagesJson[counter].path = path.join(operatingSystemDirectory, localImagesJson[counter].filename)
  osIsInstalled(localImagesJson[counter].path, function(error, installed) {
    // if the os is installed, push it to the installedImages array
    if (installed) {
      installedImages.push(localImagesJson[counter])
    }

    // run on the next image by calling this function again, with the counter+1
    loopThroughImages(installedImages, localImagesJson, counter+1, cb)
  })
}

function osIsInstalled (filepath, cb) {
  // try to access the file, return whether we can or not
  fs.stat(filepath, function (error, stat) {
    if (!error) {
      cb(null, true)
      return
    }
    cb(error)
  })
}*/
