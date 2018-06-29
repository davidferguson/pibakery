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
  transform: transform
}


function transform (xml) {
  var parser = new DOMParser()
  xml = parser.parseFromString(xml, 'application/xml')
  var blocks = xml.getElementsByTagName('block')

  while (true) {
    var blocks = xml.getElementsByTagName('block')

    var madeTransformation = false
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i]

      var transformed = transformBlock(block, xml)
      if (transformed) {
        madeTransformation = true
        break
      }
    }

    if (!madeTransformation) {
      break
    }
  }

  var string = new XMLSerializer().serializeToString(xml);
  return string
}


function transformBlock (block, xml) {
  if (isOldWiFi(block)) {
    transformOldWiFi(block)
    return true
  }

  if (isOldVncInstall(block)) {
    transformOldVncInstall(block)
    return true
  }

  if (isOldVncStart(block)) {
    transformOldVncStart(block)
    return true
  }

  return false
}


function isOldWiFi (block) {
  if (block.getAttribute('type') === 'wifisetup') {
    var fields = block.getElementsByTagName('field')
    for (var i = 0; i < fields.length; i++) {
      var field = fields[i]
      if (field.getAttribute('name') === '4') {
        return false
      }
    }

    return true
  }

  return false
}


function transformOldWiFi (block) {
  var countryCode = document.createElement('field')
  countryCode.setAttribute('name', '4')
  countryCode.innerText = 'GB'
  block.appendChild(countryCode)
  //return block
  return
}


function isOldVncInstall (block) {
  return (block.getAttribute('type') === 'vncserver')
}


function transformOldVncInstall (block) {
  // basically remove this block - vnc is already installed now
  var nexts = block.getElementsByTagName('next')
  var next = false
  for (var i = 0; i < nexts.length; i++) {
    if (nexts[i].parentNode === block) {
      next = nexts[i]
      break
    }
  }

  if (next === false) {
    // there is no block after this one, just remove it
    block.parentNode.parentNode.removeChild(block.parentNode)
    //return block
    return
  }

  // there is another block after this, replace this block with that one
  //block.parentNode.innerHTML = next.innerHTML
  block.parentNode.parentNode.appendChild(next)
  block.parentNode.parentNode.removeChild(block.parentNode)
}


function isOldVncStart (block) {
  return (block.getAttribute('type') === 'vncstart')
}


function transformOldVncStart (block) {
  block.setAttribute('type', 'vncenable')
  var field = block.getElementsByTagName('field')[0]
  field.innerText = 'Enable'

  return
}
