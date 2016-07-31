/*
    PiBakery - The easiest way to setup a Raspberry Pi
    Copyright (C) 2016  David Ferguson

    This file is part of PiBakery.

    PiBakery is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    PiBakery is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with PiBakery.  If not, see <http://www.gnu.org/licenses/>.

    PiBakery uses Google Blockly which is licensed under the Apache
    License Version 2.0, a copy of which can be found in the file
    ./app/blockly/LICENSE

    PiBakery uses Win32DiskImager (Image Writer for Windows) which is
    licensed under the GNU General Public License as published by the
    Free Software Foundation, version 2 or later, a copy of which can
    be found in the file ./CommandLineDiskImager/GPL-2

    PiBakery uses p7zip which is licensed under the GNU General Public
    License as published by the Free Software Foundation, version 2.1 or
    later, a copy of which can be found in the file p7zip-license.txt

    PiBakery uses 7zip (7za) which is licensed under the GNU Lesser
    General Public License as published by the Free Software Foundation,
    version 2.1 or later, a copy of which can be found in the file
    7zip-license.txt
*/

Blockly.Blocks['onboot'] = {
  init: function() {
    this.appendDummyInput()
        .appendField("On Every Boot");
    this.setNextStatement(true);
    this.setColour(20);
    this.setTooltip('');
    //this.setHelpUrl('http://www.example.com/');
    this.setHelpUrl('This is a very long description of how this block works, which has been placed into a space which is only meant for a URL. Hopefully Blockly allows this to be placed here, and doesn\'t check for a URL with regex or such. Anyway, onto the description of this block. This is the block that is used to select what other blocks run when the Raspberry Pi is first booted up. Lets see if we can fit some more words.');
  }
};

Blockly.Blocks['onfirstboot'] = {
  init: function() {
    this.appendDummyInput()
        .appendField("On First Boot");
    this.setNextStatement(true);
    this.setColour(20);
    this.setTooltip('');
    this.setHelpUrl('http://www.example.com/');
  }
};

Blockly.Blocks['onnextboot'] = {
  init: function() {
    this.appendDummyInput()
        .appendField("On Next Boot");
    this.setNextStatement(true);
    this.setColour(20);
    this.setTooltip('');
    this.setHelpUrl('http://www.example.com/');
  }
};

Blockly.PiBakery['onboot'] = function(block) {
  var code = '_pibakery-oneveryboot';
  return code;
};

Blockly.PiBakery['onfirstboot'] = function(block) {
  var code = '_pibakery-onfirstboot';
  return code;
};

Blockly.PiBakery['onnextboot'] = function(block) {
  var code = '_pibakery-onnextboot';
  return code;
};