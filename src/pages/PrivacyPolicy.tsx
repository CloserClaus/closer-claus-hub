import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const PrivacyPolicy = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="container mx-auto px-4 md:px-6 py-16 max-w-3xl">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
        <ArrowLeft className="h-4 w-4" /> Back to Home
      </Link>
      <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
      <div className="space-y-6 text-muted-foreground leading-relaxed">
        <p>We respect your privacy.</p>
        <div><h2 className="text-lg font-semibold text-foreground mb-2">Information we collect</h2><p>We may collect your name, email address, and usage data when you use our platform.</p></div>
        <div><h2 className="text-lg font-semibold text-foreground mb-2">How we use information</h2><p>We use your data only to provide and improve our services, communicate with you, and operate platform features.</p></div>
        <div><h2 className="text-lg font-semibold text-foreground mb-2">Email integrations</h2><p>If you connect an email provider, we only access permissions required to send emails on your behalf. We do not read or store your email content unless necessary for sending functionality.</p></div>
        <div><h2 className="text-lg font-semibold text-foreground mb-2">Data sharing</h2><p>We do not sell, rent, or trade your data.</p></div>
        <div><h2 className="text-lg font-semibold text-foreground mb-2">Security</h2><p>We use industry-standard safeguards to protect your information.</p></div>
        <div><h2 className="text-lg font-semibold text-foreground mb-2">User control</h2><p>You may disconnect integrations or request deletion of your data at any time.</p></div>
        <div><h2 className="text-lg font-semibold text-foreground mb-2">Contact</h2><p>For privacy questions contact: <a href="mailto:support@closerclaus.com" className="text-primary hover:underline">support@closerclaus.com</a></p></div>
      </div>
    </div>
  </div>
);

export default PrivacyPolicy;
