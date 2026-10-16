import os
import sys

# Ensure tests/ is on sys.path so 'import genlayer' works for contract files
tests_dir = os.path.dirname(os.path.abspath(__file__))
if tests_dir not in sys.path:
    sys.path.insert(0, tests_dir)

root_dir = os.path.dirname(tests_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
