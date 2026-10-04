import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import CashpulseHero from './CashpulseHero.jsx'
import VeteranConnectHero from './VeteranConnectHero.jsx'

const DEFAULT_SLIDE_INTERVAL = 6000
const PRODUCT_SLIDE_INTERVAL = 15000

const editorialSlides = [
  {
    category: 'People & Workforce',
    id: 'people-workforce',
    title: 'Build a workforce that moves with your ambition.',
    text: 'Recruit, pay, and retain exceptional people with senior HR thinking and intelligent systems working together.',
    image: 'https://images.pexels.com/photos/7581117/pexels-photo-7581117.jpeg?auto=compress&cs=tinysrgb&w=2200',
    cta: 'Explore workforce services',
  },
  {
    category: 'Technology & Growth',
    id: 'technology-growth',
    title: 'Make technology learn your business.',
    text: 'Cloud, automation, and AI systems designed around the way your team actually works and scales.',
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=2200&q=85',
    cta: 'Explore technology services',
  },
  {
    category: 'Business Solutions / CashPulse',
    id: 'cashpulse',
    title: 'See the money clearly. Move with confidence.',
    text: 'CashPulse brings payables, reconciliation, and AI financial answers into one calm operating view for Indian businesses.',
    image: 'https://images.pexels.com/photos/7580653/pexels-photo-7580653.jpeg?auto=compress&cs=tinysrgb&w=2200',
    cta: 'Open CashPulse',
    href: 'https://cashpulse.ofstrideservices.com/cashflow/login',
    visual: 'cashpulse',
  },
  {
    category: 'Business Solutions / Veteran Connect',
    id: 'veteran-connect',
    title: 'Match experience with the next right opportunity.',
    text: 'Veteran Connect helps employers find aligned talent with transparent job-match and ATS signals built for better decisions.',
    image: 'https://images.pexels.com/photos/3351448/pexels-photo-3351448.jpeg?auto=compress&cs=tinysrgb&w=2200',
    cta: 'Explore Veteran Connect',
    href: 'https://blue-forest-031e54600.5.azurestaticapps.net/#top',
    visual: 'veteran',
  },
  {
    category: 'Strategy',
    id: 'strategy',
    title: 'Put strategy to work, every day.',
    text: 'Sharper market intelligence and process excellence turn a good plan into measurable momentum.',
    image: 'https://images.pexels.com/photos/7580764/pexels-photo-7580764.jpeg?auto=compress&cs=tinysrgb&w=2200',
    cta: 'Explore strategy services',
  },
]

function MagneticLink({ slide }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const handlePointerMove = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    setOffset({
      x: (event.clientX - bounds.left - bounds.width / 2) * 0.12,
      y: (event.clientY - bounds.top - bounds.height / 2) * 0.12,
    })
  }

  const linkProps = {
    onPointerMove: handlePointerMove,
    onPointerLeave: () => setOffset({ x: 0, y: 0 }),
    className: 'services-hero-cta group inline-flex items-center gap-3 bg-secondary text-white px-5 py-3.5 sm:px-6 sm:py-4 rounded-lg font-semibold',
    style: { transform: `translate(${offset.x}px, ${offset.y}px)` },
  }
  const label = (
    <>
      {slide.cta}
      <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
    </>
  )

  return slide.href ? <a href={slide.href} target="_blank" rel="noreferrer" {...linkProps}>{label}</a> : <Link to={`/services#${slide.id}`} {...linkProps}>{label}</Link>
}

export default function EditorialServicesHero() {
  const [activeSlide, setActiveSlide] = useState(0)
  const touchStartX = useRef(null)
  const activeSlideData = editorialSlides[activeSlide]

  const selectSlide = (index) => {
    setActiveSlide((index + editorialSlides.length) % editorialSlides.length)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setActiveSlide((current) => (current + 1) % editorialSlides.length)
    }, editorialSlides[activeSlide].visual ? PRODUCT_SLIDE_INTERVAL : DEFAULT_SLIDE_INTERVAL)

    return () => window.clearTimeout(timer)
  }, [activeSlide])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft') selectSlide(activeSlide - 1)
      if (event.key === 'ArrowRight') selectSlide(activeSlide + 1)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeSlide])

  const handleTouchStart = (event) => {
    touchStartX.current = event.changedTouches[0].clientX
  }

  const handleTouchEnd = (event) => {
    if (touchStartX.current === null) return
    const distance = event.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(distance) > 45) selectSlide(activeSlide + (distance < 0 ? 1 : -1))
    touchStartX.current = null
  }

  return (
    <section
      className={`services-hero relative min-h-[620px] sm:min-h-[680px] flex items-end overflow-hidden bg-primary text-white ${activeSlideData.visual ? 'services-hero--product' : ''}`}
      aria-roledescription="carousel"
      aria-label="Ofstride service categories"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {editorialSlides.map((slide, index) => (
        <div
          key={slide.category}
          className={`absolute inset-0 transition-opacity duration-700 ease-out ${index === activeSlide ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          aria-hidden={index !== activeSlide}
        >
          <img src={slide.image} alt="" className={`services-hero-image absolute inset-0 w-full h-full object-cover ${index === activeSlide ? 'is-active' : ''}`} />
          <div className={`absolute inset-0 ${slide.visual ? 'bg-[#050b18]/90' : 'bg-gradient-to-r from-black via-black/80 to-black/35'}`} />
          <div className={`absolute inset-0 ${slide.visual ? 'bg-black/45' : 'bg-black/25'}`} />
        </div>
      ))}

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28 pt-28">
        <div className="services-hero-copy max-w-3xl" key={activeSlide}>
          <p className="services-hero-stagger text-secondary text-xs sm:text-sm font-bold uppercase tracking-[0.22em] mb-5">
            {editorialSlides[activeSlide].category}
          </p>
          <h1 className="services-hero-stagger text-4xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight mb-6">
            {editorialSlides[activeSlide].title}
          </h1>
          <p className="services-hero-stagger text-base sm:text-xl text-white/75 leading-relaxed max-w-2xl mb-8">
            {editorialSlides[activeSlide].text}
          </p>
          <div className="services-hero-stagger">
            <MagneticLink slide={editorialSlides[activeSlide]} />
          </div>
        </div>

        {editorialSlides[activeSlide].visual === 'cashpulse' && <div className="services-hero-product services-hero-product--cashpulse"><CashpulseHero /></div>}
        {editorialSlides[activeSlide].visual === 'veteran' && <div className="services-hero-product services-hero-product--veteran"><VeteranConnectHero /></div>}

      </div>
    </section>
  )
}
