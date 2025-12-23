import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  BookOpen, 
  Building2, 
  Calendar,
  Settings,
  Sparkles,
  Menu,
  X,
  ChevronDown,
  LogOut,
  Bell,
  CreditCard
} from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navigation = [
  // School Admin Pages
  { name: 'Dashboard', page: 'Dashboard', icon: LayoutDashboard, schoolOnly: true },
  { name: 'Setup Guide', page: 'Onboarding', icon: Sparkles, schoolOnly: true },
  { name: 'Schedule', page: 'Schedule', icon: Calendar, schoolOnly: true },
  { name: 'Teaching Groups', page: 'TeachingGroups', icon: Users, schoolOnly: true },
  { name: 'Teachers', page: 'Teachers', icon: Users, schoolOnly: true },
  { name: 'Students', page: 'Students', icon: GraduationCap, schoolOnly: true },
  { name: 'Subjects', page: 'Subjects', icon: BookOpen, schoolOnly: true },
  { name: 'Rooms', page: 'Rooms', icon: Building2, schoolOnly: true },
  { name: 'AI Advisor', page: 'AIAdvisor', icon: Sparkles, schoolOnly: true },
  { name: 'Subscription', page: 'Subscription', icon: CreditCard, schoolOnly: true },
  { name: 'Settings', page: 'Settings', icon: Settings, schoolOnly: true },
  
  // SuperAdmin Pages
  { name: 'Admin Panel', page: 'Panel', icon: Settings, superAdminOnly: true },
  { name: 'User Management', page: 'UserManagement', icon: Users, superAdminOnly: true },
  { name: 'Subscriptions', page: 'SubscriptionsOverview', icon: CreditCard, superAdminOnly: true },
  { name: 'Support Tickets', page: 'SupportTickets', icon: Bell, superAdminOnly: true },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Public pages render without authentication
  if (currentPageName === 'Landing') {
    return <>{children}</>;
  }

  // Role definitions - school_id alone determines school admin access
  const isSchoolAdmin = (userData) => !!userData?.school_id && !isSuperAdmin;
  const isNewClient = (userData) => userData && !userData.school_id && !isSuperAdmin;

  useEffect(() => {
    // Check if returning from successful subscription
    const urlParams = new URLSearchParams(window.location.search);
    const subscriptionSuccess = urlParams.get('subscription') === 'success';
    
    if (subscriptionSuccess) {
      // Force refetch user data after subscription success with retries
      console.log('Subscription success detected, waiting for webhook to process...');
      let attempts = 0;
      const maxAttempts = 10;
      
      const checkUserUpdate = () => {
        attempts++;
        base44.auth.me()
          .then(userData => {
            console.log('User data attempt', attempts, ':', userData);
            // Check if user has been upgraded (has school_id assigned)
            if (userData.school_id) {
              console.log('User upgraded successfully!');
              setUser(userData);
              setIsLoading(false);
              window.history.replaceState({}, '', window.location.pathname);
            } else if (attempts < maxAttempts) {
              // Not upgraded yet, retry after delay
              console.log('User not upgraded yet, retrying...');
              setTimeout(checkUserUpdate, 2000);
            } else {
              // Max attempts reached, show user anyway
              console.log('Max attempts reached, showing user');
              setUser(userData);
              setIsLoading(false);
              window.history.replaceState({}, '', window.location.pathname);
            }
          })
          .catch((error) => {
            console.error('Error fetching user:', error);
            if (attempts < maxAttempts) {
              setTimeout(checkUserUpdate, 2000);
            } else {
              base44.auth.redirectToLogin(window.location.pathname);
            }
          });
      };
      
      // Start checking after initial delay
      setTimeout(checkUserUpdate, 2000);
    } else {
      base44.auth.me()
        .then(async userData => {
          setUser(userData);
          
          // Check SuperAdmin status from backend
          try {
            const { data } = await base44.functions.invoke('getSuperAdminEmails');
            setIsSuperAdmin(data?.isSuperAdmin || false);
          } catch (error) {
            console.error('Error checking SuperAdmin status:', error);
            setIsSuperAdmin(false);
          }
          
          setIsLoading(false);
        })
        .catch(() => {
          base44.auth.redirectToLogin(window.location.pathname);
        });
    }
  }, [currentPageName]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Role-based access control
  if (isSuperAdmin) {
    // SuperAdmin: ONLY access Panel and super admin pages
    const schoolOnlyPages = ['Dashboard', 'Onboarding', 'Schedule', 'TeachingGroups', 'Teachers', 'Students', 'Subjects', 'Rooms', 'Constraints', 'AIAdvisor', 'Settings', 'Support', 'Subscription'];
    if (schoolOnlyPages.includes(currentPageName)) {
      window.location.replace(createPageUrl('Panel'));
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Redirecting to Admin Panel...</p>
          </div>
        </div>
      );
    }
  } else if (isSchoolAdmin(user)) {
    // School Admin: ONLY access Dashboard and school pages
    const superAdminPages = ['Panel', 'UserManagement', 'SubscriptionsOverview', 'SupportTickets'];
    if (superAdminPages.includes(currentPageName)) {
      window.location.replace(createPageUrl('Dashboard'));
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Redirecting to Dashboard...</p>
          </div>
        </div>
      );
    }
  } else if (isNewClient(user)) {
    // New clients: ONLY access Subscription page
    if (currentPageName !== 'Subscription') {
      window.location.replace(createPageUrl('Subscription'));
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Redirecting to Subscription...</p>
          </div>
        </div>
      );
    }
  }

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        :root {
          --primary: 99 102 241;
          --primary-foreground: 255 255 255;
        }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
      `}</style>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-slate-200 
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-slate-100">
            <Link to={createPageUrl('Landing')} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-semibold text-slate-900">Schedual</span>
            </Link>
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              // Strict role filtering
              if (item.superAdminOnly && !isSuperAdmin) return null;
              if (item.schoolOnly && !isSchoolAdmin(user)) return null;
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.page)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-all duration-200
                    ${isActive 
                      ? 'bg-indigo-50 text-indigo-700' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-slate-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-100 transition-colors">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-sm">
                      {getInitials(user?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-slate-900 truncate">{user?.full_name || 'User'}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => base44.auth.logout()}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-3 ml-auto">
            <Link to={createPageUrl(isSuperAdmin ? 'SupportTickets' : 'Support')}>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5 text-slate-500" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full" />
              </Button>
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}