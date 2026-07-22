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

from veteran_careers.intake import SubmitProfile as submit_profile_handler


async def main(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204)
    return submit_profile_handler(req)