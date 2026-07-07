"""
Timer trigger to keep Functions instance warm
Runs every 5 minutes - ~8,640 executions/month (within 1M free tier)
"""
import datetime
import logging
import azure.functions as func

logger = logging.getLogger("ofstride")

def main(mytimer: func.TimerRequest) -> None:
    utc_timestamp = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc).isoformat()
    logger.info(f'Keep-warm triggered at {utc_timestamp}')