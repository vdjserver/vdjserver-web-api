#!/bin/bash
# description: Forever for VDJAuth

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

forever stopall

forever -a -l $DIR/logs/forever.log -o $DIR/logs/stdout.log -e $DIR/logs/stderr.log start $DIR/app/scripts/app.js
