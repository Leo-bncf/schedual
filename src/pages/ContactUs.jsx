import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Mail, MessageCircle, Clock } from 'lucide-react';

export default function ContactUs() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-900 to-blue-800 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Contact Us</h1>
          <p className="text-lg text-slate-600">
            We're here to help. Reach out to our team anytime.
          </p>
        </div>

        {/* Main Contact Card */}
        <Card className="border-0 shadow-lg mb-8">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-6">
                <Mail className="w-10 h-10 text-blue-900" />
              </div>
              <h2 className="text-2xl font-semibold text-slate-900 mb-3">Email Support</h2>
              <p className="text-slate-600 mb-6">
                Send us an email and we'll respond as soon as possible
              </p>
              <a 
                href="mailto:support@schedual-pro.com"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors text-lg font-medium"
              >
                <Mail className="w-5 h-5" />
                support@schedual-pro.com
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-6">
              <div className="flex gap-3 items-start">
                <Clock className="w-6 h-6 text-blue-900 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Response Time</h3>
                  <p className="text-slate-600">
                    We typically respond within 24 hours during business days.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-6">
              <div className="flex gap-3 items-start">
                <MessageCircle className="w-6 h-6 text-blue-900 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">What to Include</h3>
                  <p className="text-slate-600">
                    Please include your school name and a detailed description of your inquiry.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}