import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ArrowRight, 
  Target, 
  Phone, 
  TrendingUp, 
  Users, 
  Shield, 
  Zap,
  CheckCircle2,
  Play,
  BarChart3,
  MessageSquare,
  Database
} from 'lucide-react';
import logoFull from '@/assets/logo-full.png';

const HomePage = () => {
  const diagnosticRef = useRef<HTMLDivElement>(null);
  const platformRef = useRef<HTMLDivElement>(null);

  const scrollToDiagnostic = () => {
    diagnosticRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToPlatform = () => {
    platformRef.current?.scrollIntoView({ behavior: 'smooth' });
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
            <div className="flex items-center gap-3 md:gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={scrollToPlatform}
                className="hidden md:inline-flex text-muted-foreground hover:text-foreground"
              >
                Platform
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={scrollToDiagnostic}
                className="hidden md:inline-flex text-muted-foreground hover:text-foreground"
              >
                Free Diagnostic
              </Button>
              <Link to="/auth">
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  Go to Platform
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-secondary/20 rounded-full blur-3xl animate-pulse delay-1000" />
        
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8 animate-fade-in">
              <Zap className="h-4 w-4" />
              For agencies doing $50K+/month
            </div>
            
            {/* Main Headline */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight">
              Your agency doesn't need{' '}
              <span className="relative">
                <span className="line-through text-muted-foreground/50">more leads</span>
              </span>
              <br />
              <span className="text-gradient">it needs a sales system.</span>
            </h1>
            
            {/* Subheadline */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Most agencies chase leads endlessly but never build the system to convert them. 
              We install the same sales infrastructure used by top 1% operators — so you can scale predictably.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Button 
                size="lg" 
                onClick={scrollToDiagnostic}
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-14 px-8 text-lg glow"
              >
                Is My Offer Outbound-Ready?
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Link to="/auth">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="h-14 px-8 text-lg border-border/50 hover:bg-card"
                >
                  <Play className="mr-2 h-5 w-5" />
                  See the Platform
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
                <span className="text-sm">$2M+ in closed deals</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span className="text-sm">Avg 3.2x pipeline growth</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 md:py-32 bg-card/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Why most agencies stay stuck at the same revenue
            </h2>
            <p className="text-lg text-muted-foreground">
              After working with 70+ agencies, we've identified the real blockers that prevent scale.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                title: "Chasing leads instead of building systems",
                description: "You buy more leads, hire more SDRs, but revenue stays flat. That's a process problem, not a lead problem.",
                icon: Target
              },
              {
                title: "Offers that collapse under cold attention",
                description: "Your offer converts warm referrals but dies in outbound. Cold traffic exposes structural weaknesses.",
                icon: Shield
              },
              {
                title: "No predictable path to scale",
                description: "Every month feels like starting over. Without a system, growth is just gambling with better odds.",
                icon: TrendingUp
              }
            ].map((problem, i) => (
              <Card key={i} className="bg-card/50 border-border/30 hover:border-primary/30 transition-colors">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center mb-4">
                    <problem.icon className="h-6 w-6 text-destructive" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{problem.title}</h3>
                  <p className="text-muted-foreground text-sm">{problem.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 border border-success/20 text-success text-sm font-medium mb-6">
              <CheckCircle2 className="h-4 w-4" />
              The Solution
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              A complete sales system for agencies
            </h2>
            <p className="text-lg text-muted-foreground">
              Built on the same principles used by Alex Hormozi, Russell Brunson, and other top 1% operators — 
              simplified and adapted specifically for agencies.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {[
              {
                title: "Offer Diagnostic",
                description: "Evaluate if your offer is structurally ready for outbound. Know exactly what to fix before you scale.",
                icon: BarChart3,
                highlight: "Free tool"
              },
              {
                title: "Lead Intelligence",
                description: "Apollo-powered prospecting with AI readiness scoring. Target leads most likely to convert.",
                icon: Database,
                highlight: "Save 10+ hrs/week"
              },
              {
                title: "Power Dialer",
                description: "Built-in calling with scripts, recordings, and automatic logging. No more tab-switching.",
                icon: Phone,
                highlight: "3x call volume"
              },
              {
                title: "Pipeline & CRM",
                description: "Visual deal tracking with commission management. Every deal attributed, every dollar tracked.",
                icon: TrendingUp,
                highlight: "Full visibility"
              }
            ].map((feature, i) => (
              <Card key={i} className="bg-card/50 border-border/30 hover:border-primary/30 transition-all hover:glow-sm group">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {feature.highlight}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Preview Section */}
      <section ref={platformRef} className="py-20 md:py-32 bg-card/30 overflow-hidden">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Everything you need in one platform
            </h2>
            <p className="text-lg text-muted-foreground">
              Stop juggling 5 different tools. One login, one system, complete visibility.
            </p>
          </div>
          
          {/* Platform Screenshot Mockup */}
          <div className="relative max-w-6xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-2xl glow">
              {/* Browser Chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border/50">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive/60" />
                  <div className="w-3 h-3 rounded-full bg-warning/60" />
                  <div className="w-3 h-3 rounded-full bg-success/60" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 rounded bg-card text-xs text-muted-foreground">
                    app.closerclaus.com
                  </div>
                </div>
              </div>
              
              {/* Dashboard Preview */}
              <div className="p-6 md:p-8 bg-background min-h-[400px]">
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Pipeline Value', value: '$847,500', change: '+23%' },
                    { label: 'Active Leads', value: '2,847', change: '+12%' },
                    { label: 'Deals Closed', value: '34', change: '+8%' },
                    { label: 'Conversion Rate', value: '18.2%', change: '+2.1%' }
                  ].map((stat, i) => (
                    <div key={i} className="p-4 rounded-lg bg-card border border-border/50">
                      <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                      <p className="text-xl font-bold">{stat.value}</p>
                      <p className="text-xs text-success">{stat.change}</p>
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 p-4 rounded-lg bg-card border border-border/50 h-48">
                    <p className="text-sm font-medium mb-4">Pipeline Overview</p>
                    <div className="flex items-end gap-2 h-32">
                      {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((h, i) => (
                        <div 
                          key={i} 
                          className="flex-1 bg-primary/30 rounded-t transition-all hover:bg-primary/50"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-card border border-border/50">
                    <p className="text-sm font-medium mb-4">Recent Activity</p>
                    <div className="space-y-3">
                      {[
                        'Deal closed: $24,500',
                        'New lead: Acme Corp',
                        'Call completed: 12m',
                        'Meeting booked'
                      ].map((activity, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          {activity}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              How it works
            </h2>
            <p className="text-lg text-muted-foreground">
              From diagnostic to scale in 3 simple steps
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: "01",
                title: "Diagnose your offer",
                description: "Take our free 2-minute diagnostic to see if your offer is ready for outbound — and exactly what to fix if it's not."
              },
              {
                step: "02",
                title: "Build your pipeline",
                description: "Use our lead intelligence to find and qualify prospects. AI scoring tells you who's most likely to convert."
              },
              {
                step: "03",
                title: "Close with confidence",
                description: "Power dial through your list, track every deal, and watch your pipeline grow predictably week over week."
              }
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="text-6xl font-bold text-primary/10 mb-4">{item.step}</div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
                {i < 2 && (
                  <ArrowRight className="hidden md:block absolute top-8 -right-4 h-8 w-8 text-border" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 md:py-32 bg-card/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Trusted by ambitious agencies
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                quote: "We went from chasing leads to having a repeatable system. Pipeline grew 3x in 90 days.",
                name: "Marcus Chen",
                title: "CEO, Growth Labs Agency"
              },
              {
                quote: "The offer diagnostic alone saved us months. We fixed our positioning before wasting money on outbound.",
                name: "Sarah Mitchell",
                title: "Founder, Mitchell Digital"
              },
              {
                quote: "Finally, one platform that does everything. Our SDRs are 2x more productive.",
                name: "James Rodriguez",
                title: "Sales Director, Scale Partners"
              }
            ].map((testimonial, i) => (
              <Card key={i} className="bg-card/50 border-border/30">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {[1,2,3,4,5].map((star) => (
                      <svg key={star} className="w-4 h-4 text-warning" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-foreground mb-6">"{testimonial.quote}"</p>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.title}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Offer Diagnostic CTA Section */}
      <section ref={diagnosticRef} className="py-20 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="max-w-4xl mx-auto">
            <Card className="bg-card border-primary/20 glow overflow-hidden">
              <CardContent className="p-8 md:p-12">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                      <Zap className="h-4 w-4" />
                      Free Diagnostic
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                      Is your offer actually outbound-ready?
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      Most founders fail at outbound not because of scripts or reps, but because their offer 
                      collapses under cold attention. Find out in 2 minutes.
                    </p>
                    <ul className="space-y-3 mb-8">
                      {[
                        "Get your alignment score (0-100)",
                        "Identify your primary bottleneck",
                        "Receive actionable recommendations"
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm">
                          <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <Link to="/offer-diagnostic">
                      <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground h-12 px-8">
                        Evaluate My Offer
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </Link>
                  </div>
                  
                  <div className="hidden md:block">
                    <div className="p-6 rounded-xl bg-muted/50 border border-border/50">
                      <div className="text-center mb-6">
                        <div className="text-5xl font-bold text-primary mb-2">78</div>
                        <p className="text-sm text-muted-foreground">Alignment Score</p>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Economic Feasibility</span>
                            <span>16/20</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full w-4/5 bg-primary rounded-full" />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Proof Strength</span>
                            <span>14/20</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full w-[70%] bg-primary rounded-full" />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Channel Fit</span>
                            <span>18/20</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full w-[90%] bg-success rounded-full" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-20 md:py-32 bg-card/30">
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
                features: ["1 SDR seat", "Full CRM access", "Lead intelligence", "Manual dialer", "2% platform fee"],
                popular: false
              },
              {
                name: "Beta",
                price: "$347",
                description: "For growing teams",
                features: ["2 SDR seats", "Everything in Omega", "Power dialer", "Priority support", "1.5% platform fee"],
                popular: true
              },
              {
                name: "Alpha",
                price: "$497",
                description: "For scaling agencies",
                features: ["5 SDR seats", "Everything in Beta", "Dedicated success manager", "1% platform fee"],
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
                      Get Started
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Ready to build a sales system that scales?
            </h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
              Stop chasing leads. Start building systems. Join 70+ agencies already using Closer Claus.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/offer-diagnostic">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground h-14 px-8 text-lg glow">
                  Take the Free Diagnostic
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg">
                  Go to Platform
                </Button>
              </Link>
            </div>
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
                Sales systems for ambitious agencies
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
            © {new Date().getFullYear()} Closer Claus. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
