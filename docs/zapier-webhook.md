Final Configuration Summary:
 Step 	 Type 	 Configuration 	 Status 
 1. Catch Hook 	 Trigger 	 Waits for webhook data (name, email, time, message) 	 ⚠️ Needs test 
 2. Email to Submitter 	 Gmail Send 	 To: {{email}} • Subject: Meeting Invitation 	 ✅ Ready 
 3. Email to Support 	 Gmail Send 	 To: support@ofstrideservices.com • Subject: New Meeting Request 	 ✅ Ready 
Next Steps:
To activate the Zap, you need to send test data to the webhook URL:

Copy the webhook URL from Step 1 (Catch Hook) setup panel
Send JSON test data like this:
json
{
  "name": "John Doe",
  "email": "john@example.com",
  "time": "Monday 2:00 PM",
  "message": "Interested in pricing discussion"
}
Once received, both emails will be sent automatically