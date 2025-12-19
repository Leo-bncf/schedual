import Dashboard from './pages/Dashboard';
import Teachers from './pages/Teachers';
import Students from './pages/Students';
import Subjects from './pages/Subjects';
import Rooms from './pages/Rooms';
import Schedule from './pages/Schedule';
import AIAdvisor from './pages/AIAdvisor';
import Settings from './pages/Settings';
import Constraints from './pages/Constraints';
import TeachingGroups from './pages/TeachingGroups';
import Documentation from './pages/Documentation';
import DatabaseSchema from './pages/DatabaseSchema';
import TestData from './pages/TestData';
import OptimizationEngine from './pages/OptimizationEngine';
import Onboarding from './pages/Onboarding';
import UserManagement from './pages/UserManagement';
import SuperAdmin from './pages/SuperAdmin';
import Landing from './pages/Landing';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Teachers": Teachers,
    "Students": Students,
    "Subjects": Subjects,
    "Rooms": Rooms,
    "Schedule": Schedule,
    "AIAdvisor": AIAdvisor,
    "Settings": Settings,
    "Constraints": Constraints,
    "TeachingGroups": TeachingGroups,
    "Documentation": Documentation,
    "DatabaseSchema": DatabaseSchema,
    "TestData": TestData,
    "OptimizationEngine": OptimizationEngine,
    "Onboarding": Onboarding,
    "UserManagement": UserManagement,
    "SuperAdmin": SuperAdmin,
    "Landing": Landing,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};