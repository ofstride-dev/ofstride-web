import os
import sys

import azure.functions as func

script_dir = os.path.dirname(os.path.abspath(__file__))
api_root = os.path.join(script_dir, "..")
shared_path = os.path.join(api_root, "shared")

if api_root not in sys.path:
    sys.path.insert(0, api_root)
if shared_path not in sys.path:
    sys.path.insert(0, shared_path)

from business_growth.audit_worker.__init__ import main as run_audit_worker


def main(msg: func.QueueMessage) -> None:
    run_audit_worker(msg)
