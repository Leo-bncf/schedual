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
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};