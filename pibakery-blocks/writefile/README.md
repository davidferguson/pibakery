# Writefile block

This block allows you to write text to a specified file on the raspberry pi.

Simply enter the path and filename, the content of the file and choose the file type.

## New Lines in file content

You can specify a character to be used as a newline (\n) character.

*i.e., if the characater for new lines is set to +, the follwiing applies:*
Hello+Good Bye+Hello+Again

*output as:*
Hello
Good Bye
Hello
Again

## File Type

The file is either unmodified, i.e. Normal, or it is Executable.

Executable files are modified to be executable using chmod.
