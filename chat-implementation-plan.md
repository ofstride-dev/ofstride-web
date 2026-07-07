Name: Ofstride Assistance
How can I help you?
1. Engagement-First Flow (Lead Capture Before Results)
User: "I'm looking for a business strategy consultant"
    ↓
Bot: "That sounds exciting! ... could I quickly grab a few details 
      so I can personalize your recommendations?"
    ↓
[Inline Form appears inside chat bubble]
    ├── Name
    ├── Email
    ├── Phone
    └── [Show My Matches →]
    ↓
[Form submitted → stored in DB → THEN consultants shown]
why this design ? "The user has already expressed intent (strategy consultant). The form feels like a personalization step, not a gate. The bot explains the value ("so I can personalize your recommendations") before asking. If they abandon here, you still have their intent + partial data for retargeting."

2. Polite Exit Handling- When the user says "I need to go now", the bot:
| Action                  | Copy                                                           |
| ----------------------- | -------------------------------------------------------------- |
| Acknowledges gracefully | *"No problem at all, John — I completely understand!"*         |
| Confirms data saved     | *"I've saved everything we've discussed so far"*               |
| Sends email summary     | *"I've also sent a quick summary to your email"*               |
| Easy re-entry           | *"just jump back in and I'll pick up right where we left off"* |
| Re-engagement CTA       | "Send me a reminder" / "Remind me tomorrow"                    |
Backend action on exit: Save session state (intent, partial form data, viewed consultants) → trigger email with consultant profiles + deep link back to chat → schedule follow-up if no return in 24h.

3. Off-Topic Fallback: 
When the user asks "Do you guys also do website development?" (outside your scope):
| Don't Do            | Do Instead                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Say "No, we don't"  | Acknowledge + pivot: *"While we don't directly build websites, I can connect you with consultants who specialize in digital strategy"* |
| End conversation    | Offer relevant alternative: *"Would you like me to show you IT & Digital consultants instead?"*                                        |
| Ignore the question | Provide options to stay on track or explore related services                                                                           |

4. Conversation State Machine
[OPEN] ──→ [INTENT_CAPTURED] ──→ [LEAD_CAPTURED] ──→ [CONSULTANTS_SHOWN]
              │                      │                      │
              ▼                      ▼                      ▼
         [User drops off]      [Partial form]         [User books]
              │                      │                      │
              ▼                      ▼                      ▼
         [Save intent to DB]    [Retarget email]      [Booking modal]
         [Trigger retarget]     [Continue later]      [Calendar invite]
		 
5. Backend Data Capture Points
| Event               | Data Stored                            | Trigger               |
| ------------------- | -------------------------------------- | --------------------- |
| Chat opened         | Session ID, timestamp, referrer        | `POST /sessions`      |
| Intent selected     | Consultancy type, free-text query      | `POST /intents`       |
| Lead form submitted | Name, email, phone, intent ID          | `POST /leads`         |
| Consultant viewed   | Consultant ID, timestamp, user ID      | `POST /interactions`  |
| Booking initiated   | Consultant ID, user ID, timestamp      | `POST /bookings`      |
| Exit detected       | Session duration, last message, intent | `POST /sessions/exit` |
| Off-topic query     | Query text, suggested redirect         | `POST /fallbacks`     |

6. Key Copy Principles Used
| Principle              | Example                                               |
| ---------------------- | ----------------------------------------------------- |
| **Warmth**             | *"That sounds exciting!"* — enthusiasm for their need |
| **Personalization**    | Uses their name (*"Thank you, John!"*)                |
| **Transparency**       | Explains *why* data is needed before asking           |
| **Low pressure**       | *"No problem at all"* — no guilt on exit              |
| **Value on exit**      | Email summary sent automatically                      |
| **Easy re-engagement** | Deep link + reminder options                          |
 | **Conversational** | Natural dialogue flow with quick-reply chips, typing indicators, and contextual follow-ups   |
| **Polite**         | Warm welcome banners, respectful language ("I'd be happy to help"), clear confirmation steps |
| **Assertive**      | Proactive recommendations, pre-filled consultant cards with clear CTAs, confident guidance   |
| **Modern**         | Clean minimal UI, subtle gradients, rounded corners, smooth animations, dark-mode ready      |

7. Architecture & Tech Stack
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND LAYER                                             │
│  ├── React/Vue + TypeScript                                 │
│  ├── Tailwind CSS (or styled-components)                    │
│  ├── Framer Motion (animations)                             │
│  ├── React Query (server state)                             │
│  └── Socket.io / WebRTC (real-time chat)                    │
├─────────────────────────────────────────────────────────────┤
│  AI / NLP LAYER                                             │
│  ├── Intent Classification (fine-tuned LLM)                 │
│  ├── Named Entity Recognition (budget, industry, timeline)  │
│  ├── Consultant Matching Algorithm (vector similarity)      │
│  └── Response Generation (RAG from company data)            │
├─────────────────────────────────────────────────────────────┤
│  BACKEND LAYER                                              │
│  ├── Python function app                               │
│  ├── PostgreSQL + pgvector (consultant profiles)  / quadrant          │
│  ├── Redis (session/cache)   - not required currently                               │
│  └── Webhook integrations (booking, message - existing)               │
├─────────────────────────────────────────────────────────────┤
│  DATA SOURCES (Your Company Only)                           │
│  ├── Company website API / scraped content                  │
│  ├── Internal consultant database                           │
│  ├── availability calendar                        │
│  └── Client reviews & case studies                          │
└─────────────────────────────────────────────────────────────┘

8. Key UI Components Breakdown
| Component             | Purpose                  | Design Notes                                                    |
| --------------------- | ------------------------ | --------------------------------------------------------------- |
| **Smart Header**      | Brand identity + status  | Gradient avatar, live indicator, context menu                   |
| **Welcome Banner**    | Onboarding + trust       | Friendly icon, clear value prop, no clutter                     |
| **Message Bubbles**   | Core conversation        | Asymmetric radii (bot: BL 4px, user: BR 4px), subtle shadows    |
| **Quick-Reply Chips** | Reduce typing friction   | Horizontal scroll on mobile, hover states, single-tap selection |
| **Consultant Cards**  | Rich result display      | Avatar, rating badges, skill tags, pricing, primary CTA         |
| **Typing Indicator**  | Perceived responsiveness | 3-dot bounce animation, appears during API calls                |
| **Suggestion Bar**    | Discovery prompts        | Context-aware pills below input (budget, location, reviews)     |
| **Smart Input**       | Free-text + attachments  | Auto-resize textarea, attachment button, send on Enter          |

9. critical implementation details
A. Data Isolation (Company-Only Responses)
Implement a retrieval-augmented generation (RAG) pipeline where the LLM only grounds answers in your indexed company data
Use system_prompt enforcement: "You may only reference consultants, pricing, and services from the provided company database. If information is unavailable, say: 'I don't have that detail in our records yet.'"
Regularly re-index your website + internal DB via scheduled crawlers - is it necessary

10. C. Animation Specs
Message entrance: translateY(12px) scale(0.95) → normal, 350ms, cubic-bezier(0.34, 1.56, 0.64, 1)
Card hover: translateY(-2px), border color shift, 200ms ease
Typing dots: staggered bounce, 1.4s infinite
Chip selection: background fill + color invert, 200ms
D. Accessibility
ARIA labels on all interactive elements
Keyboard navigation (Tab/Enter/Space) for chips and cards
Focus rings using --kimi-color-text-primary (dark emphasis per design system)
Screen-reader announcements for new messages (aria-live="polite")

11.. Responsive Behavior
Table
Breakpoint	Behavior
Mobile (< 480px)	Full-screen overlay, bottom-sheet input, swipeable cards
Tablet (480-768px)	Side-panel chat, consultant cards in 2-column grid
Desktop (> 768px)	Floating chat bubble → expands to 420px wide widget, or embedded in page sidebar

12. Suggested Tech Libraries

Need	Library
Chat UI framework	react-chat-widget (customize heavily) or build from scratch with Tailwind
Animations	framer-motion
Vector search	pinecone / weaviate / pgvector
LLM orchestration	LangChain or LlamaIndex
Calendar booking	Calendly API or react-big-calendar
Real-time messaging	Socket.io or Firebase Realtime DB
