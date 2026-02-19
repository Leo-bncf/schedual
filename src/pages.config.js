/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AccountManager from './pages/AccountManager';
import ClassGroups from './pages/ClassGroups';
import Constraints from './pages/Constraints';
import ContactUs from './pages/ContactUs';
import Dashboard from './pages/Dashboard';
import DatabaseSchema from './pages/DatabaseSchema';
import Documentation from './pages/Documentation';
import Landing from './pages/Landing';
import NotFound from './pages/NotFound';
import Onboarding from './pages/Onboarding';
import OptimizationEngine from './pages/OptimizationEngine';
import Panel from './pages/Panel';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Reports from './pages/Reports';
import Rooms from './pages/Rooms';
import Schedule from './pages/Schedule';
import Settings from './pages/Settings';
import Students from './pages/Students';
import Subjects from './pages/Subjects';
import Subscription from './pages/Subscription';
import SubscriptionTiered from './pages/SubscriptionTiered';
import SubscriptionsOverview from './pages/SubscriptionsOverview';
import Support from './pages/Support';
import SupportTickets from './pages/SupportTickets';
import Teachers from './pages/Teachers';
import TermsOfUse from './pages/TermsOfUse';
import TestData from './pages/TestData';
import UserManagement from './pages/UserManagement';
import FAQ from './pages/FAQ';
import DataSecurity from './pages/DataSecurity';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AccountManager": AccountManager,
    "ClassGroups": ClassGroups,
    "Constraints": Constraints,
    "ContactUs": ContactUs,
    "Dashboard": Dashboard,
    "DatabaseSchema": DatabaseSchema,
    "Documentation": Documentation,
    "Landing": Landing,
    "NotFound": NotFound,
    "Onboarding": Onboarding,
    "OptimizationEngine": OptimizationEngine,
    "Panel": Panel,
    "PrivacyPolicy": PrivacyPolicy,
    "Reports": Reports,
    "Rooms": Rooms,
    "Schedule": Schedule,
    "Settings": Settings,
    "Students": Students,
    "Subjects": Subjects,
    "Subscription": Subscription,
    "SubscriptionTiered": SubscriptionTiered,
    "SubscriptionsOverview": SubscriptionsOverview,
    "Support": Support,
    "SupportTickets": SupportTickets,
    "Teachers": Teachers,
    "TermsOfUse": TermsOfUse,
    "TestData": TestData,
    "UserManagement": UserManagement,
    "FAQ": FAQ,
    "DataSecurity": DataSecurity,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};