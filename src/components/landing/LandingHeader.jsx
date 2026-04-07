import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Calendar } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../../utils';

export default function LandingHeader() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    base44.auth.isAuthenticated().then(authenticated => {
      setIsAuthenticated(authenticated);
      if (authenticated) {
        base44.auth.me().then(setUser).catch(() => {});
      }
    });
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Top dark blue band - hidden when scrolled */}
      <div className={`bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 transition-all duration-300 ${isScrolled ? 'h-0 opacity-0' : 'h-14'} overflow-hidden`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="text-white/80 text-base">Schedual</div>
          <div className="flex items-center gap-6 text-sm">
            <Link to={createPageUrl('PrivacyPolicy')} className="text-white/70 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link to={createPageUrl('TermsOfUse')} className="text-white/70 hover:text-white transition-colors">
              Terms of Use
            </Link>
            <Link to={createPageUrl('ContactUs')} className="text-white/70 hover:text-white transition-colors">
              Contact Us
            </Link>
          </div>
        </div>
      </div>

      {/* Semi-transparent navigation strip */}
      <div className="flex justify-center mt-6">
        <div className={`bg-white/50 backdrop-blur-lg border border-slate-200/50 rounded-full transition-all duration-300 w-full max-w-6xl mx-4 ${isScrolled ? 'shadow-lg' : 'shadow-md'}`}>
          <div className="flex items-center justify-between gap-10 h-14 px-8">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-900 to-blue-800 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-semibold text-slate-900">Schedual</span>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link to={createPageUrl('About')} className="text-slate-600 hover:text-slate-900 transition-colors">
              About
            </Link>
            <Link to={createPageUrl('Solutions')} className="text-slate-600 hover:text-slate-900 transition-colors">
              Solutions
            </Link>
            <button 
              onClick={() => scrollToSection('pricing')} 
              className="text-slate-600 hover:text-slate-900 transition-colors"
            >
              Pricing
            </button>
            <Link to={createPageUrl('FAQ')} className="text-slate-600 hover:text-slate-900 transition-colors">
              FAQ
            </Link>
            <Link to={`${createPageUrl('Landing')}#demo`} className="text-slate-600 hover:text-slate-900 transition-colors">
              Book Demo
            </Link>
          </nav>

          {/* CTA Buttons */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link to={createPageUrl(['leo.bancroft34@icloud.com', 'erik.gerbst@gmail.com'].includes(user?.email?.toLowerCase()) ? 'Panel' : 'Dashboard')}>
                <Button className="bg-blue-900 hover:bg-blue-800 h-10 px-6 rounded-full">
                  {['leo.bancroft34@icloud.com', 'erik.gerbst@gmail.com'].includes(user?.email?.toLowerCase()) ? 'Go to Panel' : 'Go to Dashboard'}
                </Button>
              </Link>
            ) : (
              <>
                <Button 
                  variant="ghost"
                  onClick={() => base44.auth.redirectToLogin('/Dashboard')}
                  className="text-slate-600 hover:text-slate-900 h-10 px-6 rounded-full"
                >
                  Login
                </Button>
                <Button 
                  onClick={() => base44.auth.redirectToLogin('/Dashboard')}
                  className="bg-blue-900 hover:bg-blue-800 h-10 px-6 rounded-full"
                >
                  Sign Up
                </Button>
              </>
            )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}