import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Home, ArrowLeft } from 'lucide-react';
import { createPageUrl } from '../utils';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="max-w-md w-full border-0 shadow-xl">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-100 mb-4">
              <span className="text-4xl font-bold text-indigo-600">404</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Page Not Found</h1>
            <p className="text-slate-600 mb-6">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>

          <div className="space-y-3">
            <Link to={createPageUrl('Landing')} className="block">
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                <Home className="w-4 h-4 mr-2" />
                Go to Homepage
              </Button>
            </Link>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-sm text-slate-500">
              Need help? <Link to={createPageUrl('Support')} className="text-indigo-600 hover:text-indigo-700 font-medium">Contact Support</Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}