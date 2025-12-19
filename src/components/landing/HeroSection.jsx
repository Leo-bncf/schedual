import React from 'react';
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Users, BookOpen } from 'lucide-react';

export default function HeroSection() {
  const scrollToInfo = () => {
    const element = document.getElementById('info');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div>
            <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 leading-tight mb-6">
              Automated IB Schedule Generation
            </h1>
            <p className="text-xl text-slate-600 mb-8 leading-relaxed">
              Create conflict-free timetables for your IB school in minutes. 
              Manage teachers, students, and constraints effortlessly with AI-powered optimization.
            </p>
            <Button 
              size="lg" 
              className="bg-indigo-600 hover:bg-indigo-700 text-lg px-8 py-6"
              onClick={scrollToInfo}
            >
              Learn More
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 mt-12">
              <div>
                <div className="text-3xl font-bold text-indigo-600">95%</div>
                <div className="text-sm text-slate-600">Time Saved</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-indigo-600">100%</div>
                <div className="text-sm text-slate-600">Conflict-Free</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-indigo-600">24/7</div>
                <div className="text-sm text-slate-600">Access</div>
              </div>
            </div>
          </div>

          {/* Right Content - Visual */}
          <div className="relative">
            <div className="bg-white rounded-2xl shadow-2xl p-8 border border-slate-200">
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-lg">
                  <Calendar className="w-6 h-6 text-indigo-600" />
                  <div>
                    <div className="font-semibold text-slate-900">Automated Scheduling</div>
                    <div className="text-sm text-slate-600">Generate in seconds</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg">
                  <Users className="w-6 h-6 text-emerald-600" />
                  <div>
                    <div className="font-semibold text-slate-900">Teacher & Student Rules</div>
                    <div className="text-sm text-slate-600">Constraint management</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-violet-50 rounded-lg">
                  <BookOpen className="w-6 h-6 text-violet-600" />
                  <div>
                    <div className="font-semibold text-slate-900">IB Compliance</div>
                    <div className="text-sm text-slate-600">PYP, MYP, DP support</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}