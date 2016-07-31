'use strict';

goog.provide('Blockly.PiBakery');
goog.require('Blockly.Generator');
Blockly.PiBakery = new Blockly.Generator('PiBakery');


Blockly.PiBakery.addReservedWords();

Blockly.PiBakery.init = function(workspace) {};

Blockly.PiBakery.finish = function(code) {
  return code;
};


Blockly.PiBakery.scrubNakedValue = function(line) {
  return line;
};


Blockly.PiBakery.quote_ = function(string) {
  return string;
};

Blockly.PiBakery.scrub_ = function(block, code) {
  var nextBlock = block.nextConnection && block.nextConnection.targetBlock();
  var nextCode = Blockly.PiBakery.blockToCode(nextBlock);
  return code + nextCode;
};