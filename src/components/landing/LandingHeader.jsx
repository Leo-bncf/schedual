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
      <div className={`bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 transition-all duration-300 ${isScrolled ? 'h-0 opacity-0' : 'h-10'} overflow-hidden`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="text-white/80 text-sm">Schedual</div>
        </div>
      </div>

      {/* Semi-transparent navigation strip */}
      <div className={`bg-white/90 backdrop-blur-lg border-b border-slate-200/50 transition-all duration-300 ${isScrolled ? 'shadow-lg rounded-b-2xl mx-4' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-900 to-blue-800 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-slate-900">Schedual</span>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <button 
              onClick={() => scrollToSection('info')} 
              className="text-slate-600 hover:text-slate-900 transition-colors"
            >
              Info
            </button>
            <button 
              onClick={() => scrollToSection('how-it-works')} 
              className="text-slate-600 hover:text-slate-900 transition-colors"
            >
              How it Works
            </button>
            <button 
              onClick={() => scrollToSection('pricing')} 
              className="text-slate-600 hover:text-slate-900 transition-colors"
            >
              Pricing
            </button>
          </nav>

          {/* CTA Buttons */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link to={createPageUrl(['leo.bancroft34@icloud.com', 'erik.gerbst@gmail.com'].includes(user?.email?.toLowerCase()) ? 'Panel' : 'Dashboard')}>
                <Button className="bg-blue-900 hover:bg-blue-800">
                  {['leo.bancroft34@icloud.com', 'erik.gerbst@gmail.com'].includes(user?.email?.toLowerCase()) ? 'Go to Panel' : 'Go to Dashboard'}
                </Button>
              </Link>
            ) : (
              <>
                <Button 
                  variant="ghost"
                  onClick={() => base44.auth.redirectToLogin('/Dashboard')}
                  className="text-slate-600 hover:text-slate-900"
                >
                  Login
                </Button>
                <Button 
                  onClick={() => base44.auth.redirectToLogin('/Dashboard')}
                  className="bg-blue-900 hover:bg-blue-800"
                >
                  Sign Up
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}