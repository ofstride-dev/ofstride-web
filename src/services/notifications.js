const DEFAULT_HEADERS = {
  'Content-Type': 'application/json'
}

const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send'

function getWebhookUrl(type) {
  if (type === 'booking') {
    return import.meta.env.VITE_BOOK_CALL_WEBHOOK_URL || import.meta.env.VITE_ZAPIER_WEBHOOK_URL || ''
  }

  return import.meta.env.VITE_CONTACT_WEBHOOK_URL || import.meta.env.VITE_ZAPIER_WEBHOOK_URL || ''
}

function getEmailJsConfig() {
  return {
    serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID || '',
    publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '',
    bookingTemplateId: import.meta.env.VITE_EMAILJS_BOOKING_TEMPLATE_ID || import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '',
    contactTemplateId: import.meta.env.VITE_EMAILJS_CONTACT_TEMPLATE_ID || import.meta.env.VITE_EMAILJS_TEMPLATE_ID || ''
  }
}

function buildTemplateParams(type, payload) {
  const base = {
    name: payload.name || '',
    email: payload.email || '',
    phone: payload.phone || '',
    company: payload.company || '',
    service: payload.service || '',
    message: payload.message || '',
    submitted_at: payload.submittedAt || '',
    source: payload.source || '',
    reference: payload.bookingReference || payload.ticketReference || ''
  }

  if (type === 'booking') {
    return {
      ...base,
      date: payload.date || '',
      time: payload.time || '',
      meeting_link: payload.meetingLink || ''
    }
  }

  return base
}

async function sendViaEmailJs(type, payload) {
  const { serviceId, publicKey, bookingTemplateId, contactTemplateId } = getEmailJsConfig()
  const templateId = type === 'booking' ? bookingTemplateId : contactTemplateId

  if (!serviceId || !publicKey || !templateId) {
    return null
  }

  const recipients = payload.recipientEmails || []

  for (const recipient of recipients) {
    const response = await fetch(EMAILJS_ENDPOINT, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          ...buildTemplateParams(type, payload),
          to_email: recipient
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Email notification failed with status ${response.status}`)
    }
  }

  return { ok: true, provider: 'emailjs' }
}

async function postToWebhook(type, payload) {
  const webhookUrl = getWebhookUrl(type)

  if (!webhookUrl) {
    throw new Error('No notification provider configured. Add EmailJS or a webhook URL.')
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    throw new Error(`Notification request failed with status ${response.status}`)
  }

  return { ok: true, provider: 'webhook' }
}

export async function submitBookingRequest(formData, bookingReference) {
  const payload = {
    source: 'ofstride-book-call',
    type: 'booking',
    bookingReference,
    recipientEmails: [formData.email, 'support@ofstrideservices.com'],
    supportEmail: 'support@ofstrideservices.com',
    requesterEmail: formData.email,
    replyTo: formData.email,
    meetingLink: import.meta.env.VITE_CAL_COM_LINK || '',
    submittedAt: new Date().toISOString(),
    ...formData
  }

  const emailResult = await sendViaEmailJs('booking', payload)
  if (emailResult) {
    return emailResult
  }

  return postToWebhook('booking', payload)
}

export async function submitContactRequest(formData, ticketReference) {
  const payload = {
    source: 'ofstride-contact-form',
    type: 'contact',
    ticketReference,
    recipientEmails: [formData.email, 'support@ofstrideservices.com'],
    supportEmail: 'support@ofstrideservices.com',
    requesterEmail: formData.email,
    replyTo: formData.email,
    submittedAt: new Date().toISOString(),
    ...formData
  }

  const emailResult = await sendViaEmailJs('contact', payload)
  if (emailResult) {
    return emailResult
  }

  return postToWebhook('contact', payload)
}
