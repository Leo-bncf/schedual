import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { createPageUrl } from '../../utils';

export default function LandingFooter() {
  const landingUrl = createPageUrl('Landing');
  return (
    <footer className="bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 text-white py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600 rounded-full blur-3xl"></div>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <Link to={landingUrl} className="flex items-center gap-3 mb-4 w-fit">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-700 to-blue-600 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-semibold text-white">Schedual</span>
            </Link>
            <p className="text-sm text-white/80">
              Scheduling software for IB schools. Keep timetable setup clearer, more structured, and easier to manage.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to={`${landingUrl}#info`} className="text-white/90 hover:text-white transition-colors">Features</Link></li>
              <li><Link to={`${landingUrl}#how-it-works`} className="text-white/90 hover:text-white transition-colors">How it Works</Link></li>
              <li><Link to={`${landingUrl}#pricing`} className="text-white/90 hover:text-white transition-colors">Pricing</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold text-white mb-4">Support</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/Demo" className="text-white/90 hover:text-white transition-colors">Book Demo</Link></li>
              <li><Link to={createPageUrl('ContactUs')} className="text-white/90 hover:text-white transition-colors">Contact Us</Link></li>
              <li><Link to={createPageUrl('FAQ')} className="text-white/90 hover:text-white transition-colors">FAQ</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to={createPageUrl('PrivacyPolicy')} className="text-white/90 hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to={createPageUrl('TermsOfUse')} className="text-white/90 hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to={createPageUrl('DataSecurity')} className="text-white/90 hover:text-white transition-colors">Security & Compliance</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-white/20 text-center text-sm text-white/80">
          <p>&copy; 2026 Schedual. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}