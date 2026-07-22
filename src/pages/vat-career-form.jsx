import React, { useEffect, useRef, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../services/supabase'

const SERVICE_RANKS = {
  Army: [
    'Sepoy', 'Naik', 'Havildar', 'Naib Subedar', 'Subedar', 'Subedar Major',
    'Honorary Lieutenant', 'Honorary Captain', 'Lieutenant', 'Captain', 'Major',
    'Lt. Colonel', 'Colonel', 'Brigadier', 'Major General', 'Lt. General', 'General',
  ],
  'Air Force': [
    'Aircraftsman', 'Leading Aircraftsman', 'Corporal', 'Sergeant (SGT)',
    'Junior Warrant Officer (JWO)', 'Warrant Officer (WO)', 'Master Warrant Officer (MWO)',
    'Honorary Flying Officer', 'Honorary Flight Lieutenant', 'Flying Officer',
    'Flight Lieutenant', 'Squadron Leader', 'Wing Commander', 'Group Captain',
    'Air Commodore', 'Air Vice Marshal', 'Air Marshal', 'Air Chief Marshal',
  ],
  Navy: [
    'Seaman II', 'Seaman I', 'Leading Seaman', 'Petty Officer', 'Chief Petty Officer',
    'Master Chief Petty Officer II', 'Master Chief Petty Officer I',
    'Honorary Sub Lieutenant', 'Honorary Lieutenant', 'Sub Lieutenant', 'Lieutenant',
    'Lt. Commander', 'Commander', 'Captain', 'Commodore', 'Rear Admiral',
    'Vice Admiral', 'Admiral',
  ],
  'Coast Guard': [
    'Navik', 'Uttam Navik', 'Pradhan Navik', 'Adhikari', 'Uttam Adhikari',
    'Pradhan Adhikari', 'Assistant Commandant', 'Deputy Commandant',
    'Commandant (JG)', 'Commandant', 'DIG', 'IG', 'ADG', 'DG',
  ],
}

const initialFormData = {
  fullName: '',
  mobileNumber: '',
  emailId: '',
  pinCode: '',
  state: '',
  district: '',
  addressArea: '',
  defenceService: 'Army',
  rankAtRetirement: '',
  retirementDate: '',
  preferredJobLocation: '',
  willingToRelocate: false,
  linkedinProfile: '',
  expectedSalary: '',
  consentToShare: false,
  resume: null,
}

export default function CareerForm() {
  const hasSupabaseConfig = isSupabaseConfigured
  const [formData, setFormData] = useState(initialFormData)
  const [emailInput, setEmailInput] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loginLinkLoading, setLoginLinkLoading] = useState(false)
  const [isFetchingPin, setIsFetchingPin] = useState(false)
  const [msg, setMsg] = useState({ text: '', isErr: false })
  const redirectTimerRef = useRef(null)

  useEffect(() => {
    let mounted = true

    const bootstrapAuth = async () => {
      setAuthChecking(true)
      try {
        const { data } = await supabase.auth.getSession()
        const email = data?.session?.user?.email || ''
        if (!mounted) return
        if (email) {
          setIsVerified(true)
          setEmailInput(email)
          setFormData((prev) => ({ ...prev, emailId: email }))
        } else {
          setIsVerified(false)
        }
      } finally {
        if (mounted) {
          setAuthChecking(false)
        }
      }
    }

    bootstrapAuth()

    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email || ''
      if (email) {
        setIsVerified(true)
        setEmailInput(email)
        setFormData((prev) => ({ ...prev, emailId: email }))
      } else {
        setIsVerified(false)
      }
      setAuthChecking(false)
    })

    return () => {
      mounted = false
      authSubscription.subscription.unsubscribe()
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const fetchLocation = async () => {
      if (formData.pinCode.length !== 6) return

      setIsFetchingPin(true)
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${formData.pinCode}`)
        const data = await res.json()
        if (Array.isArray(data) && data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
          const postOffice = data[0].PostOffice[0]
          setFormData((prev) => ({
            ...prev,
            state: postOffice.State || prev.state,
            district: postOffice.District || prev.district,
            addressArea: prev.addressArea || postOffice.Name || '',
          }))
        }
      } catch (_error) {
        setMsg({ text: 'Could not fetch PIN details. Please fill location manually.', isErr: true })
      } finally {
        setIsFetchingPin(false)
      }
    }

    fetchLocation()
  }, [formData.pinCode])

  const updateField = (e) => {
    const { name, value, type, checked, files } = e.target
    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: type === 'checkbox' ? checked : type === 'file' ? files[0] : value,
      }
      if (name === 'defenceService') {
        next.rankAtRetirement = ''
      }
      return next
    })
  }

  const sendLoginLink = async () => {
    setMsg({ text: '', isErr: false })
    if (!hasSupabaseConfig) {
      setMsg({ text: 'Supabase is not configured for frontend. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local and restart Vite.', isErr: true })
      return
    }
    const normalizedEmail = emailInput.trim().toLowerCase()
    if (!normalizedEmail) {
      setMsg({ text: 'Enter a valid email address to receive your login link.', isErr: true })
      return
    }

    setLoginLinkLoading(true)
    try {
      const redirectTo = `${window.location.origin}/careers/veteran-transition`
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: redirectTo,
        },
      })

      if (error) {
        setMsg({ text: `Login link send failed: ${error.message}`, isErr: true })
        return
      }
    } catch (_error) {
      setMsg({ text: 'Login link send failed: Network request could not reach auth service. Check VITE_SUPABASE_URL and connectivity.', isErr: true })
      return
    } finally {
      setLoginLinkLoading(false)
    }

    setFormData((prev) => ({ ...prev, emailId: normalizedEmail }))
    setMsg({ text: 'Secure sign-in link sent. Check your inbox (and spam folder) and open the latest email to continue.', isErr: false })
  }

  const recoverExpiredSession = async (message = 'Your sign-in session expired. Please click Send Login Link to receive a fresh secure link.') => {
    setIsVerified(false)
    try {
      await supabase.auth.signOut()
    } catch (_error) {
      // Ignore transient sign-out errors and continue with re-auth prompt.
    }
    setMsg({ text: message, isErr: true })
  }

  const completeSubmissionAndRedirectHome = async () => {
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((resolve) => setTimeout(resolve, 900)),
      ])
    } catch (_error) {
      // Continue redirect even if sign-out has a transient failure.
    } finally {
      window.location.replace('/')
    }
  }

  const submitProfileForm = async (e) => {
    e.preventDefault()
    if (!isVerified) {
      setMsg({ text: 'Email verification via login link is required before form submission.', isErr: true })
      return
    }
    if (!formData.resume) {
      setMsg({ text: 'Please attach your resume document.', isErr: true })
      return
    }
    if (!formData.consentToShare) {
      setMsg({ text: 'Please check the consent box to share your profile with verified employers before submitting.', isErr: true })
      return
    }

    setLoading(true)
    setMsg({ text: '', isErr: false })

    const { data } = await supabase.auth.getSession()
    const accessToken = data?.session?.access_token || ''
    if (!accessToken) {
      setLoading(false)
      await recoverExpiredSession('Your sign-in session expired before submission. Please click Send Login Link and try again.')
      return
    }

    const submissionData = new FormData()
    Object.keys(formData).forEach((key) => submissionData.append(key, formData[key]))

    try {
      const res = await fetch('/api/SubmitProfile', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: submissionData,
      })
      const raw = await res.text()
      let apiMessage = raw
      try {
        const parsed = JSON.parse(raw)
        if (parsed?.error && parsed?.details) {
          apiMessage = `${parsed.error}: ${parsed.details}`
        } else if (parsed?.error) {
          apiMessage = parsed.error
        }
      } catch (_parseError) {
        // Keep raw response text when backend does not return JSON.
      }

      if (res.ok) {
        setMsg({ text: 'Thank you for your submission. Your Veteran Connect profile and resume were received successfully. Our team will review your profile and contact you soon. Redirecting to the home page...', isErr: false })
        // Keep the form disabled (loading stays true) until the redirect fires,
        // so the user cannot submit again during the confirmation countdown.
        if (redirectTimerRef.current) {
          clearTimeout(redirectTimerRef.current)
        }
        redirectTimerRef.current = setTimeout(() => {
          completeSubmissionAndRedirectHome()
        }, 2600)
        return
      }

      if (res.status === 401) {
        const authMessage = (apiMessage || '').toLowerCase()
        if (authMessage.includes('expired') || authMessage.includes('authentication required')) {
          setLoading(false)
          await recoverExpiredSession('Your sign-in session expired. Please click Send Login Link to continue.')
          return
        }
        setMsg({ text: apiMessage || 'Authentication failed. Please verify your login link and try again.', isErr: true })
        setLoading(false)
        return
      }
      setMsg({ text: apiMessage || 'Submission failed. Please try again.', isErr: true })
      setLoading(false)
    } catch {
      setMsg({ text: 'Network issue encountered. Please retry.', isErr: true })
      setLoading(false)
    }
  }

  const inputClass = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-blue-100'

  return (
    <div className="bg-surface min-h-screen pt-28 sm:pt-32 pb-12 px-4">
      <div className="max-w-3xl mx-auto rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden">
        <div className="bg-primary px-8 py-6 text-white">
          <p className="text-xs tracking-[0.16em] uppercase text-blue-100">Career Connect</p>
          <h2 className="text-2xl font-bold tracking-tight mt-1">Veteran Connect</h2>
          <p className="text-blue-100 text-sm mt-1">Secure profile intake for transition-ready veterans.</p>
        </div>

        {authChecking ? (
          <div className="p-8">
            <p className="text-sm text-slate-600">Verifying your secure login link...</p>
          </div>
        ) : !isVerified ? (
          <div className="p-8 space-y-4">
            <h3 className="text-lg font-semibold text-primary">Veteran Verification Login</h3>
            <p className="text-sm text-slate-600">Enter your email address to receive a secure sign-in link for the Veteran Connect resume form.</p>
            <div>
              <label className="block text-sm font-medium text-slate-700">Email Address</label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={sendLoginLink}
                disabled={loginLinkLoading}
                className="inline-flex items-center rounded-lg bg-secondary px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
              >
                {loginLinkLoading ? 'Sending Login Link...' : 'Send Login Link'}
              </button>
            </div>

            {msg.text && (
              <div className={`rounded-lg border px-4 py-3 text-sm ${msg.isErr ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                {msg.text}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={submitProfileForm} className="p-8 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-primary border-b border-slate-200 pb-2 mb-4">1. Profile Basics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Full Name *</label>
                  <input required type="text" name="fullName" value={formData.fullName} onChange={updateField} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Email Address *</label>
                  <input required type="email" name="emailId" value={formData.emailId} readOnly className={`${inputClass} bg-slate-100`} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Mobile Number *</label>
                  <input required type="tel" name="mobileNumber" value={formData.mobileNumber} onChange={updateField} placeholder="+919876543210" className={inputClass} />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-primary border-b border-slate-200 pb-2 mb-4">2. Service and Location</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Branch/Service *</label>
                  <select required name="defenceService" value={formData.defenceService} onChange={updateField} className={inputClass}>
                    {Object.keys(SERVICE_RANKS).map((branch) => (
                      <option key={branch} value={branch}>{branch}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Rank at Retirement *</label>
                  <select required name="rankAtRetirement" value={formData.rankAtRetirement} onChange={updateField} className={inputClass}>
                    <option value="" disabled>Select your rank</option>
                    {SERVICE_RANKS[formData.defenceService].map((rank) => (
                      <option key={rank} value={rank}>{rank}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Retirement Horizon Date *</label>
                  <input required type="date" name="retirementDate" value={formData.retirementDate} onChange={updateField} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-sm font-medium text-slate-700">PIN Code * {isFetchingPin && <span className="text-secondary text-xs ml-2">Fetching...</span>}</label>
                  <input required type="text" maxLength={6} pattern="\d{6}" name="pinCode" value={formData.pinCode} onChange={updateField} placeholder="e.g. 110001" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Area / Location *</label>
                  <input required type="text" name="addressArea" value={formData.addressArea} onChange={updateField} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">District *</label>
                  <input required type="text" name="district" value={formData.district} onChange={updateField} className={`${inputClass} bg-slate-100`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">State *</label>
                  <input required type="text" name="state" value={formData.state} onChange={updateField} className={`${inputClass} bg-slate-100`} />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700">Resume (PDF/DOCX) *</label>
                <input required type="file" name="resume" accept=".pdf,.docx" onChange={updateField} className={inputClass} />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-primary border-b border-slate-200 pb-2 mb-4">3. Preferences (Optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Preferred Job Location</label>
                  <input type="text" name="preferredJobLocation" value={formData.preferredJobLocation} onChange={updateField} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Expected Salary</label>
                  <input type="text" name="expectedSalary" value={formData.expectedSalary} onChange={updateField} className={inputClass} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">LinkedIn Profile URL</label>
                  <input type="url" name="linkedinProfile" value={formData.linkedinProfile} onChange={updateField} className={inputClass} />
                </div>
                <label className="md:col-span-2 flex items-center text-sm text-slate-700">
                  <input type="checkbox" name="willingToRelocate" checked={formData.willingToRelocate} onChange={updateField} className="h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary" />
                  <span className="ml-2">Willing to relocate for role opportunities</span>
                </label>
                <label className="md:col-span-2 flex items-center text-sm text-slate-700">
                  <input required type="checkbox" name="consentToShare" checked={formData.consentToShare} onChange={updateField} className="h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary" />
                  <span className="ml-2">Consent to share profile with verified employers *</span>
                </label>
              </div>
            </div>

            {msg.text && (
              <div className={`rounded-lg border px-4 py-3 text-sm ${msg.isErr ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                {msg.text}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button type="submit" disabled={loading || !!(msg.text && !msg.isErr)} className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white shadow hover:bg-[#0a1f6b] disabled:cursor-not-allowed disabled:opacity-60">
                {msg.text && !msg.isErr ? 'Submitted' : loading ? 'Submitting Profile...' : 'Submit Profile'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}