import AIAdvisor from './pages/AIAdvisor';
import Constraints from './pages/Constraints';
import Dashboard from './pages/Dashboard';
import DatabaseSchema from './pages/DatabaseSchema';
import Documentation from './pages/Documentation';
import Landing from './pages/Landing';
import NotFound from './pages/NotFound';
import Onboarding from './pages/Onboarding';
import OptimizationEngine from './pages/OptimizationEngine';
import Panel from './pages/Panel';
import Rooms from './pages/Rooms';
import Schedule from './pages/Schedule';
import Settings from './pages/Settings';
import Students from './pages/Students';
import Subjects from './pages/Subjects';
import SubscriptionsOverview from './pages/SubscriptionsOverview';
import Support from './pages/Support';
import SupportTickets from './pages/SupportTickets';
import Teachers from './pages/Teachers';
import TeachingGroups from './pages/TeachingGroups';
import TestData from './pages/TestData';
import UserManagement from './pages/UserManagement';
import AccountManager from './pages/AccountManager';
import Subscription from './pages/Subscription';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIAdvisor": AIAdvisor,
    "Constraints": Constraints,
    "Dashboard": Dashboard,
    "DatabaseSchema": DatabaseSchema,
    "Documentation": Documentation,
    "Landing": Landing,
    "NotFound": NotFound,
    "Onboarding": Onboarding,
    "OptimizationEngine": OptimizationEngine,
    "Panel": Panel,
    "Rooms": Rooms,
    "Schedule": Schedule,
    "Settings": Settings,
    "Students": Students,
    "Subjects": Subjects,
    "SubscriptionsOverview": SubscriptionsOverview,
    "Support": Support,
    "SupportTickets": SupportTickets,
    "Teachers": Teachers,
    "TeachingGroups": TeachingGroups,
    "TestData": TestData,
    "UserManagement": UserManagement,
    "AccountManager": AccountManager,
    "Subscription": Subscription,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};