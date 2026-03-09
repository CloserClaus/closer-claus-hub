import { useState } from 'react';
import { usePageTracking } from '@/hooks/usePageTracking';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowRight, 
  Target, 
  Phone, 
  TrendingUp, 
  Users, 
  Zap,
  CheckCircle2,
  BarChart3,
  Mail,
  FileSignature,
  DollarSign,
  GraduationCap,
  Search,
  Bot,
  ScrollText,
  Briefcase,
  Loader2
} from 'lucide-react';
import logoFull from '@/assets/logo-full.png';

const HomePage = () => {
  usePageTracking();
  const [appForm, setAppForm] = useState({ full_name: '', email: '', country: '', experience: '', resume_text: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleApplicationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appForm.full_name.trim() || !appForm.email.trim() || !appForm.country.trim() || !appForm.experience) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('sdr_applications' as any).insert({
        full_name: appForm.full_name.trim(),
        email: appForm.email.trim(),
        country: appForm.country.trim(),
        experience: appForm.experience,
        resume_text: appForm.resume_text.trim() || null,
      });
      if (error) throw error;
      setSubmitted(true);
      toast.success('Application submitted! We\'ll be in touch.');
    } catch {
      toast.error('Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/30">
        <div className="container mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center">
              <img src={logoFull} alt="Closer Claus" className="h-8 md:h-10" />
            </Link>
            <Link to="/auth">
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Try It Out For Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-secondary/20 rounded-full blur-3xl animate-pulse delay-1000" />
        
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8 animate-fade-in">
              <Zap className="h-4 w-4" />
              Sales Infrastructure + Marketplace
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight">
              Stop Hiring Blind.{' '}
              <br className="hidden md:block" />
              Stop Juggling Tools.{' '}
              <br className="hidden md:block" />
              <span className="text-gradient">Start Closing.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Closer Claus gives your agency pre-vetted sales reps AND the entire infrastructure 
              they need to sell — leads, dialer, email, CRM, contracts, and commissions. All in one platform.
            </p>
            
            <div className="flex items-center justify-center mb-16">
              <Link to="/auth">
                <Button 
                  size="lg" 
                  className="bg-primary hover:bg-primary/90 text-primary-foreground h-14 px-10 text-lg glow"
                >
                  Try It Out For Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
            
            {/* Social Proof Bar */}
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[1,2,3,4,5].map((i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/60 to-secondary/60 border-2 border-background" />
                  ))}
                </div>
                <span className="text-sm">70+ agencies scaled</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span className="text-sm">Hundreds of pre-vetted reps</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Two Sides of the Platform */}
      <section className="py-20 md:py-32 bg-card/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Two problems. One platform.
            </h2>
            <p className="text-lg text-muted-foreground">
              Closer Claus isn't just another SaaS tool — it's a marketplace AND infrastructure platform built for agencies.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <Card className="bg-card/50 border-border/30 hover:border-primary/30 transition-all">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Users className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Find Reps That Actually Close</h3>
                <p className="text-muted-foreground mb-6">
                  "I've hired 3 SDRs this year and they all sucked." Sound familiar? 
                  Access hundreds of experienced, pre-vetted sales reps. Post a job, review applicants, 
                  send contracts, and onboard — all in minutes.
                </p>
                <ul className="space-y-2">
                  {['Pre-vetted experienced closers', 'Post jobs & review applicants', 'Send contracts in one click', 'Onboard reps in minutes'].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/30 hover:border-primary/30 transition-all">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Zap className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Give Them Everything to Sell</h3>
                <p className="text-muted-foreground mb-6">
                  "I'm paying for Apollo, a dialer, a CRM, and an email tool — and nothing talks to each other." 
                  Replace your entire sales stack. Leads, dialer, email sequences, CRM, scripts, training — all built in.
                </p>
                <ul className="space-y-2">
                  {['Leads + dialer + email + CRM', 'Everything connected, zero tab-switching', 'Commission tracking built in', 'Training hub for new reps'].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Platform Demo Video */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
              <Zap className="h-4 w-4" />
              2-Minute Walkthrough
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              See It In Action
            </h2>
            <p className="text-lg text-muted-foreground">
              Watch how agencies use Closer Claus to find reps, build pipeline, and close deals — all from one platform.
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <div className="rounded-xl border border-border/50 overflow-hidden shadow-2xl glow">
              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                <iframe
                  src="https://www.loom.com/embed/9e6d01a399b3457cb78e5fd8676da3e0?sid=a68c8ce7-6fa2-42ce-b0b1-2df47ebd38ba"
                  frameBorder="0"
                  allowFullScreen
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                  title="Closer Claus Platform Demo"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 md:py-32 bg-card/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              How it works
            </h2>
            <p className="text-lg text-muted-foreground">
              From signup to closed deals in 4 simple steps
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {[
              {
                step: "01",
                title: "Post a Job",
                description: "Describe your offer and what you need. Experienced reps apply within hours."
              },
              {
                step: "02",
                title: "Hire & Onboard",
                description: "Review applicants, send contracts, assign training — all inside the platform."
              },
              {
                step: "03",
                title: "Your Reps Start Selling",
                description: "They use built-in leads, dialer, and email to fill your pipeline."
              },
              {
                step: "04",
                title: "Track & Pay",
                description: "Every deal tracked, every commission calculated, every payout automated."
              }
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="text-6xl font-bold text-primary/10 mb-4">{item.step}</div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.description}</p>
                {i < 3 && (
                  <ArrowRight className="hidden md:block absolute top-8 -right-4 h-8 w-8 text-border" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Full Feature Breakdown */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Everything your agency needs. Nothing it doesn't.
            </h2>
            <p className="text-lg text-muted-foreground">
              Stop juggling 5 different tools. One login, one system, complete visibility.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 max-w-7xl mx-auto">
            {[
              { icon: Search, title: 'Lead Intelligence', desc: 'Apollo-powered prospecting with AI readiness scoring' },
              { icon: Phone, title: 'Power Dialer', desc: 'Built-in calling with scripts, recordings, and logging' },
              { icon: Mail, title: 'Email Sequences', desc: 'Automated follow-ups that never fall through the cracks' },
              { icon: TrendingUp, title: 'CRM & Pipeline', desc: 'Visual deal tracking with full pipeline visibility' },
              { icon: Briefcase, title: 'Job Marketplace', desc: 'Post jobs and hire from a pool of vetted SDRs' },
              { icon: FileSignature, title: 'Contracts', desc: 'Generate, send, and e-sign contracts in minutes' },
              { icon: DollarSign, title: 'Commission Tracking', desc: 'Auto-calculated commissions with Stripe payouts' },
              { icon: GraduationCap, title: 'Training Hub', desc: 'Onboard new reps with custom training materials' },
              { icon: BarChart3, title: 'Offer Diagnostic', desc: 'AI-powered analysis of your outbound readiness' },
              { icon: Bot, title: 'Klaus AI Assistant', desc: 'Your in-platform AI sales ops assistant' },
            ].map((feature, i) => (
              <Card key={i} className="bg-card/50 border-border/30 hover:border-primary/30 transition-colors">
                <CardContent className="p-5">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold mb-1">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="py-20 md:py-32 bg-card/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              If any of this sounds like you…
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              '"I\'ve hired 3 SDRs this year and they all sucked"',
              '"I\'m paying for 5 tools and nothing talks to each other"',
              '"I don\'t know which rep closed what or how much I owe them"',
              '"Onboarding a new rep takes weeks"',
              '"I have no idea if my offer even works for cold outbound"',
              '"Every month feels like starting from zero"',
            ].map((pain, i) => (
              <Card key={i} className="bg-card/50 border-border/30">
                <CardContent className="p-6">
                  <p className="text-foreground font-medium italic">{pain}</p>
                  <p className="text-sm text-primary mt-3 font-medium">Closer Claus fixes this →</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/auth">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground h-14 px-10 text-lg glow">
                Try It Out For Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-muted-foreground">
              Choose the plan that fits your team size. Scale as you grow.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                name: "Omega",
                price: "$247",
                description: "Perfect for solo agencies",
                features: ["1 SDR seat", "Full CRM access", "Lead intelligence", "Manual dialer", "1 free number", "1,000 free mins/mo", "2% platform fee"],
                popular: false
              },
              {
                name: "Beta",
                price: "$347",
                description: "For growing teams",
                features: ["2 SDR seats", "Everything in Omega", "Power dialer", "2 free numbers", "1,000 free mins/mo", "Priority support", "1.5% platform fee"],
                popular: true
              },
              {
                name: "Alpha",
                price: "$497",
                description: "For scaling agencies",
                features: ["5 SDR seats", "Everything in Beta", "5 free numbers", "1,000 free mins/mo", "Dedicated success manager", "1% platform fee"],
                popular: false
              }
            ].map((plan, i) => (
              <Card key={i} className={`relative overflow-hidden ${plan.popular ? 'border-primary glow' : 'bg-card/50 border-border/30'}`}>
                {plan.popular && (
                  <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium">
                    Most Popular
                  </div>
                )}
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth">
                    <Button 
                      className={`w-full ${plan.popular ? 'bg-primary hover:bg-primary/90' : 'bg-muted hover:bg-muted/80'}`}
                    >
                      Try It Out For Free
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Sales Rep Application Section */}
      <section className="py-20 md:py-32 bg-card/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-start">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
                  <Target className="h-4 w-4" />
                  For Sales Reps
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Want to Join Closer Claus as a Sales Rep?
                </h2>
                <p className="text-muted-foreground mb-6">
                  We connect experienced closers with agencies that need them. If you've got the skills, 
                  we've got the opportunities. Get matched with agencies, use world-class sales tools, 
                  and earn commissions on every deal you close.
                </p>
                <ul className="space-y-3">
                  {[
                    'Get matched with agencies in your niche',
                    'Use built-in leads, dialer, and CRM',
                    'Earn commissions on every closed deal',
                    'Level up and reduce platform fees',
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <Card className="bg-card border-border/50">
                <CardContent className="p-6">
                  {submitted ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-4" />
                      <h3 className="text-xl font-bold mb-2">Application Received!</h3>
                      <p className="text-muted-foreground">
                        We'll review your application and get back to you within 48 hours.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleApplicationSubmit} className="space-y-4">
                      <h3 className="text-lg font-semibold mb-2">Apply Now</h3>
                      <div>
                        <Label htmlFor="full_name">Full Name *</Label>
                        <Input
                          id="full_name"
                          value={appForm.full_name}
                          onChange={(e) => setAppForm(p => ({ ...p, full_name: e.target.value }))}
                          placeholder="John Smith"
                          maxLength={100}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={appForm.email}
                          onChange={(e) => setAppForm(p => ({ ...p, email: e.target.value }))}
                          placeholder="john@example.com"
                          maxLength={255}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="country">Country *</Label>
                        <Input
                          id="country"
                          value={appForm.country}
                          onChange={(e) => setAppForm(p => ({ ...p, country: e.target.value }))}
                          placeholder="United States"
                          maxLength={100}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="experience">Sales Experience *</Label>
                        <Select value={appForm.experience} onValueChange={(v) => setAppForm(p => ({ ...p, experience: v }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select experience level" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0-1 years">0-1 years</SelectItem>
                            <SelectItem value="1-3 years">1-3 years</SelectItem>
                            <SelectItem value="3-5 years">3-5 years</SelectItem>
                            <SelectItem value="5+ years">5+ years</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="resume">Resume / Experience Summary</Label>
                        <Textarea
                          id="resume"
                          value={appForm.resume_text}
                          onChange={(e) => setAppForm(p => ({ ...p, resume_text: e.target.value }))}
                          placeholder="Tell us about your sales experience, industries you've worked in, and results you've achieved..."
                          rows={4}
                          maxLength={2000}
                        />
                      </div>
                      <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={submitting}>
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Submit Application
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Ready to scale your agency's sales?
            </h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
              Join 70+ agencies already using Closer Claus to find reps, build pipeline, and close more deals.
            </p>
            <Link to="/auth">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground h-14 px-10 text-lg glow">
                Try It Out For Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <img src={logoFull} alt="Closer Claus" className="h-8" />
              <span className="text-sm text-muted-foreground">
                Sales infrastructure + marketplace for ambitious agencies
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="mailto:Business@closerclaus.com" className="hover:text-foreground transition-colors">
                Contact
              </a>
              <Link to="/auth" className="hover:text-foreground transition-colors">
                Login
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border/30 text-center text-sm text-muted-foreground">
            <div className="flex items-center justify-center gap-6 mb-4">
              <Link to="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link>
            </div>
            © {new Date().getFullYear()} Closer Claus. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
