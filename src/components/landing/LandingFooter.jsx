import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { createPageUrl } from '../../utils';

export default function LandingFooter() {
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
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-700 to-blue-600 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-semibold text-white">IB Schedule</span>
            </div>
            <p className="text-sm text-white/80">
              Automated scheduling for IB schools. Save time, reduce conflicts, and focus on education.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#info" className="text-white/90 hover:text-white transition-colors">Features</a></li>
              <li><a href="#how-it-works" className="text-white/90 hover:text-white transition-colors">How it Works</a></li>
              <li><a href="#pricing" className="text-white/90 hover:text-white transition-colors">Pricing</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold text-white mb-4">Support</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="text-white/90 hover:text-white transition-colors">Documentation</a></li>
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
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-white/20 text-center text-sm text-white/80">
          <p>&copy; 2025 IB Schedule. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}