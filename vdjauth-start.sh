#!/bin/bash
# description: Forever for VDJAuth

forever stopall

forever -m 1 -a -l $(pwd)/logs/forever.log -o $(pwd)/logs/stdout.log -e $(pwd)stderr.log start $(pwd)/app/scripts/app.js
