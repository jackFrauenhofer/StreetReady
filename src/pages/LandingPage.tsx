import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Users,
  GraduationCap,
  Mic,
  Calendar,
  CheckCircle2,
  Shield,
  Brain,
  BarChart3,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlareCard } from '@/components/ui/glare-card';
import { AnimatedTestimonials } from '@/components/ui/animated-testimonials';

function useScrollVisible(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

function FadeIn({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useScrollVisible();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

const FEATURES = [
  {
    num: '01',
    title: 'Networking CRM',
    description: 'Track every banker, every conversation, every follow-up. Drag-and-drop contacts through your recruiting pipeline from first outreach to offer.',
    image: '/or_networking.jpeg',
  },
  // {
  //   num: '02',
  //   title: 'Flashcard Learning',
  //   description: 'Master technical and behavioral questions with spaced repetition. 40+ decks covering accounting, valuation, M&A, LBO, and behavioral categories.',
  //   icon: GraduationCap,
  // },
  {
    num: '02',
    title: 'AI Mock Interviews with Personalized Feedback',
    description: 'Practice timed interview questions and get instant AI-powered scoring on structure, clarity, specificity, confidence, and conciseness.',
    image: '/or_mock.jpeg',
  },
  {
    num: '03',
    title: 'Win the Offer',
    description: 'With our AI-powered feedback and personalized interview preparation, you can land the offer you deserve.',
    image: '/or_winjob.jpeg',
  },
];

const TRUST_ITEMS = [
  { icon: Brain, title: 'AI-Powered Feedback', desc: 'Get personalized scoring and suggested answers from GPT-4o' },
  { icon: BarChart3, title: 'Spaced Repetition', desc: 'Scientifically proven method to retain technical knowledge' },
  { icon: Users, title: 'CRM Pipeline', desc: 'Visual Kanban board to manage your networking contacts' },
  { icon: Shield, title: 'Resume Analysis', desc: 'Upload your resume for tailored interview feedback' },
];

const STEPS = [
  { num: '01', title: 'Sign up for free', desc: 'Create your account in seconds. No credit card required.' },
  { num: '02', title: 'Build your pipeline', desc: 'Add contacts, schedule calls, and track your networking progress.' },
  { num: '03', title: 'Ace your interviews', desc: 'Study flashcards, practice mock interviews, and land the offer.' },
];

const FAQS = [
  { q: 'Is OfferReady free to use?', a: 'Yes! OfferReady offers a free tier with access to core features including the pipeline CRM, flashcards, and mock interviews. Upgrade to Pro for unlimited access.' },
  { q: 'What types of interviews does it prepare me for?', a: 'OfferReady covers both technical (accounting, valuation, DCF, M&A, LBO) and behavioral (story, motivation, teamwork, leadership) interview categories commonly asked in investment banking recruiting.' },
  { q: 'How does the AI mock interview work?', a: 'You record your answer to a timed question. Our AI transcribes your response and scores it across five dimensions: structure, clarity, specificity, confidence, and conciseness. You also get a suggested model answer.' },
  { q: 'Can I upload my resume?', a: 'Yes. Upload your resume and our AI will analyze it to provide personalized feedback during mock interviews, tailoring suggested answers to your specific experience.' },
  { q: 'Is my data secure?', a: 'Absolutely. We use Supabase for secure data storage with row-level security. Your data is encrypted in transit and at rest. We never share your information with third parties.' },
];

export function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-background/90 backdrop-blur-md border-b border-border/50 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-[1300px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="OfferReady" className="w-8 h-8" />
            <span className="font-semibold text-lg text-white">OfferReady</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollTo('features')} className={`text-sm transition-colors ${scrolled ? 'text-muted-foreground hover:text-foreground' : 'text-white/70 hover:text-white'}`}>Features</button>
            <button onClick={() => scrollTo('how-it-works')} className={`text-sm transition-colors ${scrolled ? 'text-muted-foreground hover:text-foreground' : 'text-white/70 hover:text-white'}`}>How It Works</button>
            <button onClick={() => scrollTo('faq')} className={`text-sm transition-colors ${scrolled ? 'text-muted-foreground hover:text-foreground' : 'text-white/70 hover:text-white'}`}>FAQ</button>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/auth')} className={scrolled ? '' : 'text-white hover:bg-white/10'}>
              Sign In
            </Button>
            <Button size="sm" onClick={() => navigate('/auth?mode=signup')} className={scrolled ? '' : 'bg-white text-black hover:bg-white/90'}>
              Get Started
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-background border-b border-border/50 px-6 pb-4 space-y-3">
            <button onClick={() => scrollTo('features')} className="block text-sm text-muted-foreground hover:text-foreground">Features</button>
            <button onClick={() => scrollTo('how-it-works')} className="block text-sm text-muted-foreground hover:text-foreground">How It Works</button>
            <button onClick={() => scrollTo('faq')} className="block text-sm text-muted-foreground hover:text-foreground">FAQ</button>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/auth')} className="flex-1">Sign In</Button>
              <Button size="sm" onClick={() => navigate('/auth?mode=signup')} className="flex-1">Get Started</Button>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 px-6 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="/or_nyc_skyline.jpeg" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.65)_55%,rgba(0,0,0,0.85)_100%)]" />
        </div>
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-16 z-[1] bg-gradient-to-t from-background to-transparent" />
        <div className="relative z-10 max-w-[1300px] mx-auto text-center">
          <FadeIn>
            <p className="text-sm font-medium tracking-wide uppercase text-white/60 mb-4">
              Built for aspiring investment bankers
            </p>
          </FadeIn>
          <FadeIn delay={100}>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight max-w-4xl mx-auto text-white">
              Your unfair advantage for IB recruiting
            </h1>
          </FadeIn>
          <FadeIn delay={200}>
            <p className="mt-6 text-lg md:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
              Track your networking pipeline, master technical concepts with spaced repetition, 
              and practice mock interviews with AI-powered feedback — all in one place.
            </p>
          </FadeIn>
          <FadeIn delay={300}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" onClick={() => navigate('/auth?mode=signup')} className="px-8 text-base bg-white text-black hover:bg-white/90">
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg" onClick={() => scrollTo('features')} className="px-8 text-base border-white text-white hover:bg-white/10">
                See Features
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Trust Badges — Glare Cards
      <section className="py-20 md:py-28 px-6">
        <div className="max-w-[1300px] mx-auto">
          <FadeIn>
            <p className="text-sm font-medium tracking-wide uppercase text-muted-foreground mb-3 text-center">
              Why OfferReady
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-14">
              Everything you need to land the offer
            </h2>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 justify-items-center">
            {TRUST_ITEMS.map((item, i) => (
              <FadeIn key={item.title} delay={i * 120}>
                <GlareCard className="flex flex-col items-center justify-center px-6 py-10 text-center">
                  <item.icon className="h-10 w-10 text-white mb-5" />
                  <h3 className="font-semibold text-white text-base mb-2">{item.title}</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">{item.desc}</p>
                </GlareCard>
              </FadeIn>
            ))}
          </div>
        </div>
      </section> */}

      {/* Features Section */}
      <section id="features" className="py-20 md:py-28 px-6">
        <div className="max-w-[1300px] mx-auto">
          <FadeIn>
            <p className="text-sm font-medium tracking-wide uppercase text-muted-foreground mb-3 text-center">
              Everything you need
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
              One platform for your entire recruiting journey
            </h2>
          </FadeIn>

          <div className="space-y-16 md:space-y-24">
            {FEATURES.map((feature, i) => (
              <FadeIn key={feature.num} delay={100}>
                <div className={`flex flex-col md:flex-row items-start gap-8 md:gap-16 ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
                  {/* Text */}
                  <div className="flex-1 space-y-4">
                    <span className="text-sm font-mono text-muted-foreground">{feature.num}</span>
                    <h3 className="text-2xl md:text-3xl font-bold">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed text-lg">
                      {feature.description}
                    </p>
                    <Button variant="outline" onClick={() => navigate('/auth?mode=signup')} className="mt-2">
                      Get Started
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                  {/* Visual */}
                  <div className="flex-1 w-full">
                    <div className="aspect-[4/3] rounded-2xl bg-muted/60 border border-border/50 flex items-center justify-center overflow-hidden">
                      {feature.image ? (
                        <img src={feature.image} alt={feature.title} className="w-full h-full object-cover" />
                      ) : feature.icon ? (
                        <feature.icon className="h-16 w-16 text-muted-foreground/30" />
                      ) : null}
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="relative py-20 md:py-28 px-6 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="/or_nyc_skyline2.jpeg" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.65)_55%,rgba(0,0,0,0.85)_100%)]" />
        </div>
        {/* Top fade */}
        <div className="absolute top-0 left-0 right-0 h-16 z-[1] bg-gradient-to-b from-background to-transparent" />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-16 z-[1] bg-gradient-to-t from-background to-transparent" />
        <div className="relative z-10 max-w-[1300px] mx-auto">
          <FadeIn>
            <p className="text-sm font-medium tracking-wide uppercase text-white/60 mb-3 text-center">
              Simple to start
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-white">
              How it works
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {STEPS.map((step, i) => (
              <FadeIn key={step.num} delay={i * 150} className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white text-black font-bold text-lg mb-5">
                  {step.num}
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">{step.title}</h3>
                <p className="text-white/70 leading-relaxed">{step.desc}</p>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={400}>
            <div className="text-center mt-14">
              <Button size="lg" onClick={() => navigate('/auth?mode=signup')} className="px-8 text-base bg-white text-black hover:bg-white/90">
                Start for Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* NOTE: Testimonials hidden until real ones are available
      <section className="py-20 md:py-28 px-6">
        <div className="max-w-[1300px] mx-auto">
          <FadeIn>
            <p className="text-sm font-medium tracking-wide uppercase text-muted-foreground mb-3 text-center">
              Trusted by students
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              Built by candidates, for candidates
            </h2>
          </FadeIn>
          <FadeIn delay={150}>
            <AnimatedTestimonials
              autoplay
              testimonials={[
                {
                  quote: "OfferReady's flashcard system helped me nail my technicals. The spaced repetition actually works — I went from blanking on LBO questions to walking through them confidently.",
                  name: "Alex Chen",
                  designation: "Finance Major · Target School",
                  src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=3387&auto=format&fit=crop&ixlib=rb-4.0.3",
                },
                {
                  quote: "The pipeline CRM kept me organized during recruiting season. I tracked 40+ contacts and never missed a follow-up. It's like a personal assistant for networking.",
                  name: "Sarah Martinez",
                  designation: "Business Student · Semi-Target",
                  src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=3387&auto=format&fit=crop&ixlib=rb-4.0.3",
                },
                {
                  quote: "Mock interview scoring gave me honest feedback I couldn't get anywhere else. The AI caught filler words and vague answers I didn't even notice. Total game changer.",
                  name: "James Park",
                  designation: "Economics Major · Target School",
                  src: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=3540&auto=format&fit=crop&ixlib=rb-4.0.3",
                },
                {
                  quote: "I used OfferReady from start to finish — flashcards for prep, CRM for networking, mock interviews before superdays. Landed an offer at a top EB.",
                  name: "Emily Watson",
                  designation: "Finance Major · Target School",
                  src: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=3540&auto=format&fit=crop&ixlib=rb-4.0.3",
                },
              ]}
            />
          </FadeIn>
        </div>
      </section>
      */}

      {/* FAQ */}
      <section id="faq" className="py-20 md:py-28 px-6 bg-card border-y border-border/50">
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <p className="text-sm font-medium tracking-wide uppercase text-muted-foreground mb-3 text-center">
              Questions?
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Frequently asked questions
            </h2>
          </FadeIn>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <FadeIn key={i} delay={i * 50}>
                <div className="border border-border/50 rounded-xl overflow-hidden bg-background">
                  <button
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span className="font-medium text-sm pr-4">{faq.q}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
                      {faq.a}
                    </div>
                  )}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 md:py-28 px-6 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="/or_nyc_skyline3.jpeg" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.65)_55%,rgba(0,0,0,0.85)_100%)]" />
        </div>
        {/* Top fade */}
        <div className="absolute top-0 left-0 right-0 h-16 z-[1] bg-gradient-to-b from-background to-transparent" />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-16 z-[1] bg-gradient-to-t from-background to-transparent" />
        <div className="relative z-10 max-w-[1300px] mx-auto text-center">
          <FadeIn>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white">
              Ready to land the offer?
            </h2>
            <p className="text-lg text-white/70 mb-10 max-w-xl mx-auto">
              Join OfferReady and take control of your investment banking recruiting journey.
            </p>
            <Button size="lg" onClick={() => navigate('/auth?mode=signup')} className="px-10 text-base bg-white text-black hover:bg-white/90">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 px-6">
        <div className="max-w-[1300px] mx-auto">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <img src="/favicon.svg" alt="OfferReady" className="w-7 h-7" />
                <span className="font-semibold">OfferReady</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                Your personal CRM and preparation platform for investment banking recruiting.
              </p>
            </div>

            <div className="flex gap-12">
              <div>
                <h4 className="font-semibold text-sm mb-3">Product</h4>
                <div className="space-y-2">
                  <button onClick={() => scrollTo('features')} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Features</button>
                  <button onClick={() => scrollTo('how-it-works')} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">How It Works</button>
                  <button onClick={() => scrollTo('faq')} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</button>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-3">Legal</h4>
                <div className="space-y-2">
                  <a href="/privacy" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</a>
                  <a href="/terms" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Terms of Service</a>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-border/50 text-center">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} OfferReady. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
