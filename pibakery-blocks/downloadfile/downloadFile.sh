#!/bin/bash

function getUriFilename() {
    header="$(curl -A 'PiBakery' -sI "$1" | tr -d '\r')"

    filename="$(echo "$header" | grep -o -E 'filename=.*$')"
    if [[ -n "$filename" ]]; then
        echo "${filename#filename=}"
        return
    fi

    filename="$(echo "$header" | grep -o -E 'Location:.*$')"
    if [[ -n "$filename" ]]; then
        basename "${filename#Location\:}"
        return
    fi

    return 1
}

if [ -d $2 ]
then
  filename="$(getUriFilename $1)"
  echo $filename
  curl -A 'PiBakery' -o "$2/$filename" "$1" -L
else
  curl -A 'PiBakery' -o "$2" "$1" -L
fi
