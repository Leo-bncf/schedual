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
      <div className={`bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 transition-all duration-300 ${isScrolled ? 'h-0 opacity-0' : 'h-20'} overflow-hidden`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="text-white/80 text-sm">Schedual</div>
        </div>
      </div>

      {/* Semi-transparent navigation strip */}
      <div className="flex justify-center mt-2">
        <div className={`bg-white/90 backdrop-blur-lg border border-slate-200/50 rounded-full transition-all duration-300 w-full max-w-4xl mx-4 ${isScrolled ? 'shadow-lg' : 'shadow-md'}`}>
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
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link to={createPageUrl(['leo.bancroft34@icloud.com', 'erik.gerbst@gmail.com'].includes(user?.email?.toLowerCase()) ? 'Panel' : 'Dashboard')}>
                <Button size="sm" className="bg-blue-900 hover:bg-blue-800 h-8">
                  {['leo.bancroft34@icloud.com', 'erik.gerbst@gmail.com'].includes(user?.email?.toLowerCase()) ? 'Go to Panel' : 'Go to Dashboard'}
                </Button>
              </Link>
            ) : (
              <>
                <Button 
                  size="sm"
                  variant="ghost"
                  onClick={() => base44.auth.redirectToLogin('/Dashboard')}
                  className="text-slate-600 hover:text-slate-900 h-8"
                >
                  Login
                </Button>
                <Button 
                  size="sm"
                  onClick={() => base44.auth.redirectToLogin('/Dashboard')}
                  className="bg-blue-900 hover:bg-blue-800 h-8"
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