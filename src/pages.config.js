import ClassGroups from './pages/ClassGroups';
import Constraints from './pages/Constraints';
import ContactUs from './pages/ContactUs';
import DatabaseSchema from './pages/DatabaseSchema';
import Documentation from './pages/Documentation';
import Landing from './pages/Landing';
import NotFound from './pages/NotFound';
import Onboarding from './pages/Onboarding';
import OptimizationEngine from './pages/OptimizationEngine';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Rooms from './pages/Rooms';
import Schedule from './pages/Schedule';
import Settings from './pages/Settings';
import Students from './pages/Students';
import Subjects from './pages/Subjects';
import Subscription from './pages/Subscription';
import SubscriptionsOverview from './pages/SubscriptionsOverview';
import Support from './pages/Support';
import SupportTickets from './pages/SupportTickets';
import Teachers from './pages/Teachers';
import TeachingGroups from './pages/TeachingGroups';
import TermsOfUse from './pages/TermsOfUse';
import TestData from './pages/TestData';
import UserManagement from './pages/UserManagement';
import AccountManager from './pages/AccountManager';
import Dashboard from './pages/Dashboard';
import Panel from './pages/Panel';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ClassGroups": ClassGroups,
    "Constraints": Constraints,
    "ContactUs": ContactUs,
    "DatabaseSchema": DatabaseSchema,
    "Documentation": Documentation,
    "Landing": Landing,
    "NotFound": NotFound,
    "Onboarding": Onboarding,
    "OptimizationEngine": OptimizationEngine,
    "PrivacyPolicy": PrivacyPolicy,
    "Rooms": Rooms,
    "Schedule": Schedule,
    "Settings": Settings,
    "Students": Students,
    "Subjects": Subjects,
    "Subscription": Subscription,
    "SubscriptionsOverview": SubscriptionsOverview,
    "Support": Support,
    "SupportTickets": SupportTickets,
    "Teachers": Teachers,
    "TeachingGroups": TeachingGroups,
    "TermsOfUse": TermsOfUse,
    "TestData": TestData,
    "UserManagement": UserManagement,
    "AccountManager": AccountManager,
    "Dashboard": Dashboard,
    "Panel": Panel,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};