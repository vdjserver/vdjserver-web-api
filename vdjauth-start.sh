#!/bin/bash
# description: Forever for VDJAuth

forever stopall

forever -a -l $(pwd)/logs/forever.log -o $(pwd)/logs/stdout.log -e $(pwd)/logs/stderr.log start $(pwd)/app/scripts/app.js
