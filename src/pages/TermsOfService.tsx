import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const TermsOfService = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="container mx-auto px-4 md:px-6 py-16 max-w-3xl">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
        <ArrowLeft className="h-4 w-4" /> Back to Home
      </Link>
      <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
      <div className="space-y-6 text-muted-foreground leading-relaxed">
        <p>By using this platform, you agree to these terms.</p>
        <div><h2 className="text-lg font-semibold text-foreground mb-2">Use of service</h2><p>You agree to use the platform only for lawful business purposes.</p></div>
        <div><h2 className="text-lg font-semibold text-foreground mb-2">No guarantees</h2><p>The platform is provided "as is" without guarantees of performance or results.</p></div>
        <div><h2 className="text-lg font-semibold text-foreground mb-2">Responsibility</h2><p>You are responsible for how you use the platform, including outreach, messaging, and communications.</p></div>
        <div><h2 className="text-lg font-semibold text-foreground mb-2">Integrations</h2><p>You are responsible for any third-party accounts you connect.</p></div>
        <div><h2 className="text-lg font-semibold text-foreground mb-2">Limitation of liability</h2><p>We are not liable for damages resulting from use of the platform.</p></div>
        <div><h2 className="text-lg font-semibold text-foreground mb-2">Changes</h2><p>We may update these terms anytime. Continued use means acceptance.</p></div>
        <div><h2 className="text-lg font-semibold text-foreground mb-2">Contact</h2><p><a href="mailto:support@closerclaus.com" className="text-primary hover:underline">support@closerclaus.com</a></p></div>
      </div>
    </div>
  </div>
);

export default TermsOfService;
