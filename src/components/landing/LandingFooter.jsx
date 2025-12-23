import React from 'react';
import { Calendar, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';

export default function LandingFooter() {
  return (
    <footer className="relative border-t border-purple-800/30 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-semibold text-white">Schedual</span>
            </div>
            <p className="text-purple-200 max-w-md">
              AI-powered scheduling platform designed specifically for IB Diploma Programme schools. 
              Automating timetabling to save time and reduce errors.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-semibold text-white mb-4">Product</h3>
            <ul className="space-y-2 text-purple-200">
              <li><a href="#info" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold text-white mb-4">Support</h3>
            <ul className="space-y-2 text-purple-200">
              <li>
                <a href="mailto:support@schedual-pro.com" className="hover:text-white transition-colors flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Contact Us
                </a>
              </li>
              <li>
                <Link to={createPageUrl('PrivacyPolicy')} className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to={createPageUrl('TermsOfUse')} className="hover:text-white transition-colors">
                  Terms of Use
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-purple-800/30 mt-8 pt-8 text-center text-purple-300">
          <p>&copy; {new Date().getFullYear()} Schedual. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}