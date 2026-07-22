import azure.functions as func

# Import blueprints from your specific capability folders
from veteran_careers.intake import veteran_bp
from events.cal_webhook import events_bp

# Initialize the main Function App
app = func.FunctionApp()

# Register the routes
app.register_functions(veteran_bp)
app.register_functions(events_bp)

# You can continue to register other existing blueprints here
# app.register_functions(chat_bp)
# app.register_functions(jobs_bp)