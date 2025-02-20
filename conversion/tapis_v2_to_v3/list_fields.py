from __future__ import print_function
import json
import argparse
import os
import sys

if (__name__=="__main__"):
    parser = argparse.ArgumentParser(description='List fields for name in Meta JSON file.')
    parser.add_argument('json_file', type=str, help='Input JSON file name')
    parser.add_argument('object_name', type=str, help='Object name')
    args = parser.parse_args()

    names = {}
    with open(args.json_file, 'r') as fp:
        line = fp.readline()
        while line:
            obj = json.loads(line)
            if obj['name'] == args.object_name:
                for field in obj['value'].keys():
                    if names.get(field) is None:
                        names[field] = 1
                    else:
                        names[field] += 1
            line = fp.readline()

        print(json.dumps(names, indent=2))
        print(len(names.keys()))
