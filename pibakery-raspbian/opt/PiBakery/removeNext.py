#!/usr/bin/python
# Removes the nextBoot xml from blockly

from xml.dom import minidom

xmldoc = minidom.parse("/boot/PiBakery/blocks.xml")
root = xmldoc.documentElement

blocks = xmldoc.getElementsByTagName("block")
for block in blocks:
  if block.hasAttribute("type"):
    if block.getAttribute("type") == "onnextboot":
      root.removeChild(block)

with open("/boot/PiBakery/blocks.xml", "wb") as blockfile:
  root.writexml(blockfile)
