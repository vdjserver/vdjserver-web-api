from __future__ import print_function
import json
import argparse
import os
import sys

if (__name__=="__main__"):
    parser = argparse.ArgumentParser(description='Count names in Meta JSON file.')
    parser.add_argument('json_file', type=str, help='Input JSON file name')
    args = parser.parse_args()

    names = {}
    if args.json_file:
        with open(args.json_file, 'r') as fp:
            line = fp.readline()
            while line:
                obj = json.loads(line)
                if names.get(obj['name']) is None:
                    names[obj['name']] = 1
                else:
                    names[obj['name']] += 1
                line = fp.readline()

            print(json.dumps(names, indent=2))
            print(len(names.keys()))
