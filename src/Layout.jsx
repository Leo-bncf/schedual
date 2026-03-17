import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
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
  CreditCard,
  User,
  Upload,
  FileText
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
  { name: 'Schedules', page: 'Schedules', icon: Calendar, schoolOnly: true },
  { name: 'Class Groups', page: 'ClassGroups', icon: Users, schoolOnly: true },
  { name: 'Teachers', page: 'Teachers', icon: Users, schoolOnly: true },
  { name: 'Students', page: 'Students', icon: GraduationCap, schoolOnly: true },
  { name: 'Subjects', page: 'Subjects', icon: BookOpen, schoolOnly: true },
  { name: 'Rooms', page: 'Rooms', icon: Building2, schoolOnly: true },
  { name: 'Settings', page: 'Settings', icon: Settings, schoolOnly: true },
  
  // SuperAdmin Pages
  { name: 'Admin Panel', page: 'Panel', icon: Settings, superAdminOnly: true },
  { name: 'User Management', page: 'Panel', icon: Users, superAdminOnly: true, query: '?tab=users' },
  { name: 'Analytics', page: 'Panel', icon: LayoutDashboard, superAdminOnly: true, query: '?tab=analytics' },
  { name: 'Automation', page: 'Panel', icon: Sparkles, superAdminOnly: true, query: '?tab=automation' },
  { name: 'Subscriptions', page: 'SubscriptionsOverview', icon: CreditCard, superAdminOnly: true },
  { name: 'Support Tickets', page: 'SupportTickets', icon: Bell, superAdminOnly: true },
];

export default function Layout({ children, currentPageName }) {
  // Public pages render immediately without authentication
  const publicPages = ['Landing', 'PrivacyPolicy', 'TermsOfUse', 'ContactUs', 'FAQ', 'DataSecurity'];
  if (publicPages.includes(currentPageName)) {
    return <>{children}</>;
  }

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [school, setSchool] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);



  // Role definitions - school_id alone determines school admin access
  const isSchoolAdmin = (userData) => !!userData?.school_id && !isSuperAdmin;
  const isNewClient = (userData) => userData && !userData.school_id && !isSuperAdmin;
  const hasActiveSubscription = () => school && (school.subscription_status === 'active' || school.subscription_status === 'trialing');

  // Suppress browser 403 errors in console by handling them silently
  useEffect(() => {
    const handleResourceError = (event) => {
      if (event.target && (event.target.tagName === 'IMG' || event.target.tagName === 'SCRIPT' || event.target.tagName === 'LINK')) {
        event.preventDefault(); // Suppress browser console error
      }
    };

    window.addEventListener('error', handleResourceError, true);

    return () => {
      window.removeEventListener('error', handleResourceError, true);
    };
  }, []);

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const subscriptionSuccess = urlParams.get('subscription') === 'success';

        if (subscriptionSuccess) {
          let assigned = false;
          try {
            // After successful checkout, try to detect and attach via PendingInvitation
            const { data: inviteData } = await base44.functions.invoke('checkPendingInvitations');
            if (inviteData?.schoolAssigned) {
              assigned = true;
              alert(`Payment successful! You've been linked to ${inviteData.schoolName}. Please log in again.`);
            } else {
              alert('Payment successful! If you already had an account, just continue. If not, please sign up or log in to access your dashboard.');
            }
          } catch (e) {
            console.error('Post-checkout linking error:', e);
            alert('Payment successful! Please sign in to complete linking.');
          }
          if (assigned) {
            base44.auth.logout('/');
            return;
          }
          // If not assigned, continue normal flow (reconcile will try after login)
        }

        const userData = await base44.auth.me();

        // Check for pending invitations
        try {
          const { data: inviteData } = await base44.functions.invoke('checkPendingInvitations');
          if (inviteData?.schoolAssigned) {
            // School was just assigned - force logout to refresh JWT token with new school_id
            alert('Welcome! Your school has been set up. Please log in again to access your dashboard.');
            base44.auth.logout(window.location.pathname);
            return;
          }
        } catch (inviteError) {
          console.error('Pending invitation check error:', inviteError);
        }

        setUser(userData);

        // Skip JWT school_id sync check - rely on JWT token from auth.me()

        // Check if superadmin FIRST
        let isSuperAdminUser = false;
        try {
          const { data } = await base44.functions.invoke('getSuperAdminEmails');
          isSuperAdminUser = data?.isSuperAdmin || false;
        } catch (adminErr) {
          console.error('Error fetching super admin status:', adminErr);
          const hardAllowed = ["erik.gerbst@gmail.com", "leo.bancroft34@icloud.com"];
          isSuperAdminUser = hardAllowed.includes(userData?.email?.toLowerCase());
        }
        setIsSuperAdmin(isSuperAdminUser);

        // Superadmins skip verification and school fetching
        if (isSuperAdminUser) {
          setIsLoading(false);
          return;
        }

        // If user has no school yet, first hydrate from User entity (immediate effect after admin assignment). If still none, attempt reconcile with Stripe.
        if (!userData?.school_id) {
          try {
            const meRec = await base44.entities.User.filter({ id: userData.id });
            const derivedSchoolId = meRec?.[0]?.school_id;
            if (derivedSchoolId) {
              alert('Your account was linked to a school. We\u2019ll refresh your session now.');
              base44.auth.logout(window.location.pathname);
              return;
            } else {
              const { data: rec } = await base44.functions.invoke('reconcileSubscription');
              if (rec?.assigned && rec.schoolId) {
                alert('Subscription detected and your school has been linked. We\u2019ll refresh your session now.');
                base44.auth.logout(window.location.pathname);
                return;
              }
            }
          } catch (e) {
            console.error('Hydration/reconcile step error:', e);
          }
        }

        // Fetch school data if user has a school
        if (userData?.school_id) {
          try {
            const schools = await base44.entities.School.filter({ id: userData.school_id });
            const userSchool = schools[0] || null;
            setSchool(userSchool);
          } catch (schoolError) {
            console.error('Error fetching school:', schoolError);
          }
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Auth error:', error);
        setIsLoading(false);
        base44.auth.redirectToLogin(window.location.pathname);
      }
    };



    loadAuth();
  }, []);



  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }



  // Role-based access control with React Router navigation
  const schoolOnlyPages = ['Dashboard', 'Onboarding', 'Schedule', 'TeachingGroups', 'Teachers', 'Students', 'Subjects', 'Rooms', 'Constraints', 'AIAdvisor', 'Settings', 'Support'];
  const superAdminPages = ['Panel', 'UserManagement', 'SubscriptionsOverview', 'SupportTickets'];

  if (isSuperAdmin && schoolOnlyPages.includes(currentPageName)) {
    return <Navigate to={createPageUrl('Panel')} replace />;
  } else if (isSchoolAdmin(user) && superAdminPages.includes(currentPageName)) {
    return <Navigate to={createPageUrl('Dashboard')} replace />;
  } else if (isNewClient(user) && !superAdminPages.includes(currentPageName) && currentPageName !== 'Subscription' && currentPageName !== 'SubscriptionTiered' && currentPageName !== 'AccountManager' && currentPageName !== 'Support') {
    return <Navigate to={createPageUrl('Subscription')} replace />;
  } else if (isSchoolAdmin(user) && !hasActiveSubscription() && currentPageName !== 'Subscription' && currentPageName !== 'SubscriptionTiered' && currentPageName !== 'AccountManager' && currentPageName !== 'Support') {
    // Block access to school features if subscription is inactive/expired
    return <Navigate to={createPageUrl('Subscription')} replace />;
  }

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
      <div className="min-h-screen bg-slate-50">
        <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');

        :root {
          --primary: 99 102 241;
          --primary-foreground: 255 255 255;
        }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        h1, h2, h3, h4, h5, h6 {
          font-family: 'Space Grotesk', 'Inter', sans-serif;
          letter-spacing: -0.02em;
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
            <div className="flex items-center justify-between h-20 px-6 border-b border-slate-100">
            <Link to={createPageUrl('Landing')} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-900 to-blue-800 flex items-center justify-center">
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
          <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
            {navigation.filter(item => {
              if (item.superAdminOnly && !isSuperAdmin) return false;
              if (item.schoolOnly && !isSchoolAdmin(user)) return false;
              return true;
            }).length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="text-slate-400 mb-3">
                  <Calendar className="w-12 h-12 mx-auto opacity-50" />
                </div>
                <p className="text-sm text-slate-500 font-medium mb-2">Nothing here yet</p>
                <p className="text-xs text-slate-400">Activate a subscription to unlock all features</p>
              </div>
            ) : (
              navigation.map((item) => {
                // Strict role filtering
                if (item.superAdminOnly && !isSuperAdmin) return null;
                if (item.schoolOnly && !isSchoolAdmin(user)) return null;
                const currentQuery = window.location.search || '';
                const isActive = item.query
                  ? currentPageName === item.page && currentQuery === item.query
                  : currentPageName === item.page && !navigation.some(navItem => navItem.page === item.page && navItem.query && navItem.query === currentQuery);
                return (
                  <Link
                    key={item.name}
                    to={`${createPageUrl(item.page)}${item.query || ''}`}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                      transition-all duration-200
                      ${isActive 
                        ? 'bg-blue-500 text-white shadow-lg' 
                        : 'text-slate-600 hover:bg-blue-50 hover:text-blue-800'
                      }
                    `}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    {item.name}
                  </Link>
                );
              })
            )}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-slate-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-100 transition-colors">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-gradient-to-br from-blue-900 to-blue-800 text-white text-sm">
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
                <DropdownMenuItem asChild>
                  <Link to={createPageUrl('AccountManager')} className="cursor-pointer">
                    <User className="w-4 h-4 mr-2" />
                    Account Manager
                  </Link>
                </DropdownMenuItem>
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
        <header className="sticky top-0 z-30 flex items-center justify-between h-20 px-6 sm:px-8 bg-white/60 backdrop-blur-xl border-b border-slate-200/50">
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-3 ml-auto">
          {isSuperAdmin ? (
            <Link 
              to={createPageUrl('SupportTickets')}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 rounded-lg transition-colors"
            >
              Support Tickets
            </Link>
          ) : isSchoolAdmin(user) && (
            <Link 
              to={createPageUrl('Support')}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 rounded-lg transition-colors"
            >
              Support Ticket
            </Link>
          )}
          </div>
        </header>

        {/* Page content */}
        <main className="p-6 sm:p-8 lg:p-12 bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  );
}