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
import ActionPlan from './pages/ActionPlan';
import Activation from './pages/Activation';
import Approval from './pages/Approval';
import Concentration from './pages/Concentration';
import Dashboard from './pages/Dashboard';
import DataCenter from './pages/DataCenter';
import Efficiency from './pages/Efficiency';
import Input from './pages/Input';
import MixHealth from './pages/MixHealth';
import OperatingSystem from './pages/OperatingSystem';
import Overview from './pages/Overview';
import ReportCenter from './pages/ReportCenter';
import Timeline from './pages/Timeline';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ActionPlan": ActionPlan,
    "Activation": Activation,
    "Approval": Approval,
    "Concentration": Concentration,
    "Dashboard": Dashboard,
    "DataCenter": DataCenter,
    "Efficiency": Efficiency,
    "Input": Input,
    "MixHealth": MixHealth,
    "OperatingSystem": OperatingSystem,
    "Overview": Overview,
    "ReportCenter": ReportCenter,
    "Timeline": Timeline,
}

export const pagesConfig = {
    mainPage: "Overview",
    Pages: PAGES,
    Layout: __Layout,
};