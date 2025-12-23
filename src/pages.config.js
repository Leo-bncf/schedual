import AIAdvisor from './pages/AIAdvisor';
import AccountManager from './pages/AccountManager';
import Constraints from './pages/Constraints';
import Dashboard from './pages/Dashboard';
import DatabaseSchema from './pages/DatabaseSchema';
import Documentation from './pages/Documentation';
import NotFound from './pages/NotFound';
import Onboarding from './pages/Onboarding';
import OptimizationEngine from './pages/OptimizationEngine';
import Panel from './pages/Panel';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Rooms from './pages/Rooms';
import Schedule from './pages/Schedule';
import Settings from './pages/Settings';
import Students from './pages/Students';
import Subjects from './pages/Subjects';
import Subscription from './pages/Subscription';
import SubscriptionsOverview from './pages/SubscriptionsOverview';
import SupportTickets from './pages/SupportTickets';
import Teachers from './pages/Teachers';
import TeachingGroups from './pages/TeachingGroups';
import TermsOfUse from './pages/TermsOfUse';
import TestData from './pages/TestData';
import UserManagement from './pages/UserManagement';
import Landing from './pages/Landing';
import Support from './pages/Support';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIAdvisor": AIAdvisor,
    "AccountManager": AccountManager,
    "Constraints": Constraints,
    "Dashboard": Dashboard,
    "DatabaseSchema": DatabaseSchema,
    "Documentation": Documentation,
    "NotFound": NotFound,
    "Onboarding": Onboarding,
    "OptimizationEngine": OptimizationEngine,
    "Panel": Panel,
    "PrivacyPolicy": PrivacyPolicy,
    "Rooms": Rooms,
    "Schedule": Schedule,
    "Settings": Settings,
    "Students": Students,
    "Subjects": Subjects,
    "Subscription": Subscription,
    "SubscriptionsOverview": SubscriptionsOverview,
    "SupportTickets": SupportTickets,
    "Teachers": Teachers,
    "TeachingGroups": TeachingGroups,
    "TermsOfUse": TermsOfUse,
    "TestData": TestData,
    "UserManagement": UserManagement,
    "Landing": Landing,
    "Support": Support,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};