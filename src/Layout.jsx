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
  Upload
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
import LoginVerification from './components/auth/LoginVerification';

const navigation = [
  // School Admin Pages
  { name: 'Dashboard', page: 'Dashboard', icon: LayoutDashboard, schoolOnly: true },
  { name: 'Setup Guide', page: 'Onboarding', icon: Sparkles, schoolOnly: true },
  { name: 'Schedule', page: 'Schedule', icon: Calendar, schoolOnly: true },
  { name: 'Class Groups', page: 'ClassGroups', icon: Users, schoolOnly: true },
  { name: 'Teaching Groups', page: 'TeachingGroups', icon: Users, schoolOnly: true },
  { name: 'Teachers', page: 'Teachers', icon: Users, schoolOnly: true },
  { name: 'Students', page: 'Students', icon: GraduationCap, schoolOnly: true },
  { name: 'Subjects', page: 'Subjects', icon: BookOpen, schoolOnly: true },
  { name: 'Rooms', page: 'Rooms', icon: Building2, schoolOnly: true },
  { name: 'Settings', page: 'Settings', icon: Settings, schoolOnly: true },
  
  // SuperAdmin Pages
  { name: 'Admin Panel', page: 'Panel', icon: Settings, superAdminOnly: true },
  { name: 'User Management', page: 'UserManagement', icon: Users, superAdminOnly: true },
  { name: 'Subscriptions', page: 'SubscriptionsOverview', icon: CreditCard, superAdminOnly: true },
  { name: 'Support Tickets', page: 'SupportTickets', icon: Bell, superAdminOnly: true },
];

export default function Layout({ children, currentPageName }) {
  // Public pages render immediately without authentication
  const publicPages = ['Landing', 'PrivacyPolicy', 'TermsOfUse', 'ContactUs'];
  if (publicPages.includes(currentPageName)) {
    return <>{children}</>;
  }

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [sessionToken, setSessionToken] = useState(null);

  // Role definitions - school_id alone determines school admin access
  const isSchoolAdmin = (userData) => !!userData?.school_id && !isSuperAdmin;
  const isNewClient = (userData) => userData && !userData.school_id && !isSuperAdmin;

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const subscriptionSuccess = urlParams.get('subscription') === 'success';
        
        if (subscriptionSuccess) {
          let attempts = 0;
          const maxAttempts = 10;
          
          const checkUserUpdate = async () => {
            attempts++;
            try {
              const userData = await base44.auth.me();
              if (userData.school_id) {
                setUser(userData);
                const { data } = await base44.functions.invoke('getSuperAdminEmails');
                setIsSuperAdmin(data?.isSuperAdmin || false);
                await checkLoginVerification(userData);
                window.history.replaceState({}, '', window.location.pathname);
              } else if (attempts < maxAttempts) {
                setTimeout(checkUserUpdate, 2000);
              } else {
                setUser(userData);
                const { data } = await base44.functions.invoke('getSuperAdminEmails');
                setIsSuperAdmin(data?.isSuperAdmin || false);
                await checkLoginVerification(userData);
                window.history.replaceState({}, '', window.location.pathname);
              }
            } catch (error) {
              console.error('Error fetching user:', error);
              if (attempts < maxAttempts) {
                setTimeout(checkUserUpdate, 2000);
              } else {
                setIsLoading(false);
                base44.auth.redirectToLogin(window.location.pathname);
              }
            }
          };
          
          setTimeout(checkUserUpdate, 2000);
        } else {
          const userData = await base44.auth.me();
          
          // Check for pending invitations
          try {
            const { data: inviteData } = await base44.functions.invoke('checkPendingInvitations');
            if (inviteData?.schoolAssigned) {
              // Refresh user data after school assignment
              const updatedUser = await base44.auth.me();
              setUser(updatedUser);
            } else {
              setUser(userData);
            }
          } catch (inviteError) {
            console.error('Pending invitation check error:', inviteError);
            setUser(userData);
          }
          
          const { data } = await base44.functions.invoke('getSuperAdminEmails');
          setIsSuperAdmin(data?.isSuperAdmin || false);
          
          await checkLoginVerification(userData);
        }
      } catch (error) {
        console.error('Auth error:', error);
        setIsLoading(false);
        base44.auth.redirectToLogin(window.location.pathname);
      }
    };

    const checkLoginVerification = async (userData) => {
      try {
        const response = await base44.functions.invoke('sendLoginVerification');
        if (response.data.success) {
          if (response.data.alreadyVerified || response.data.superAdmin) {
            setIsLoading(false);
            return;
          }
          setSessionToken(response.data.sessionToken);
          setNeedsVerification(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Login verification check error:', error);
        setIsLoading(false);
      }
    };

    loadAuth();
  }, []);

  const handleVerified = async () => {
    setNeedsVerification(false);
  };

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

  if (needsVerification) {
    return (
      <>
        <LoginVerification 
          open={needsVerification}
          onVerified={handleVerified}
          sessionToken={sessionToken}
        />
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Verifying your login...</p>
          </div>
        </div>
      </>
    );
  }

  // Role-based access control with React Router navigation
  const schoolOnlyPages = ['Dashboard', 'Onboarding', 'Schedule', 'TeachingGroups', 'Teachers', 'Students', 'Subjects', 'Rooms', 'Constraints', 'AIAdvisor', 'Settings', 'Support', 'Subscription'];
  const superAdminPages = ['Panel', 'UserManagement', 'SubscriptionsOverview', 'SupportTickets'];

  if (isSuperAdmin && schoolOnlyPages.includes(currentPageName)) {
    return <Navigate to={createPageUrl('Panel')} replace />;
  } else if (isSchoolAdmin(user) && superAdminPages.includes(currentPageName)) {
    return <Navigate to={createPageUrl('Dashboard')} replace />;
  } else if (isNewClient(user) && currentPageName !== 'Subscription' && currentPageName !== 'AccountManager' && currentPageName !== 'Support') {
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
          <div className="flex items-center justify-between h-16 px-6 border-b border-slate-100">
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
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
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
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.name}
                    to={createPageUrl(item.page)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                      transition-all duration-200
                      ${isActive 
                        ? 'bg-blue-50 text-blue-900' 
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }
                    `}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className={`w-5 h-5 ${isActive ? 'text-blue-900' : 'text-slate-400'}`} />
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
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}