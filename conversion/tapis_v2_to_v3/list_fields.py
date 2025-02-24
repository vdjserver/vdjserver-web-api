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
            try:
                obj = json.loads(line)
                for item in obj:
                    if isinstance(item, dict) and 'name' in item:
                        if item['name'] == args.object_name:
                            for field in item['value'].keys():
                                if names.get(field) is None:
                                    names[field] = 1
                                else:
                                    names[field] += 1
                    else:
                        print("Item is not a dictionary or 'name' key not found")
            except json.JSONDecodeError as e:
                print(f"Error decoding JSON: {e}")

            line = fp.readline()

        print(json.dumps(names, indent=2))
        print(len(names.keys()))
