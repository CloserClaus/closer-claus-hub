import { ArrowRight, Play, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const DemoVideo = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/images/main_page_logo.png" alt="CloserClaus" className="h-8" />
          </Link>
          <Link to="/auth">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Video Section */}
      <section className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Play className="h-4 w-4" />
            Platform Demo
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            See How It Works
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Watch a 2-minute walkthrough of the platform and see how agencies are scaling their outbound sales.
          </p>
        </div>

        {/* Loom Embed */}
        <div className="rounded-xl overflow-hidden border border-border/50 shadow-2xl mb-16">
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
            <iframe
              src="https://www.loom.com/embed/9e6d01a399b3457cb78e5fd8676da3e0"
              frameBorder="0"
              allowFullScreen
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
            
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center space-y-6">
          <h2 className="text-2xl md:text-3xl font-bold">Ready to Scale Your Outbound?</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Book a call with our team and we'll show you how Closer Claus can work for your agency.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="h-14 px-8 text-lg" asChild>
              <a href="https://calendly.com/closer_claus/30-minute-meeting" target="_blank" rel="noopener noreferrer">
                <Calendar className="mr-2 h-5 w-5" />
                Book a Call
              </a>
            </Button>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg">
                Try the Platform
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>);

};

export default DemoVideo;