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
import Overview from './pages/Overview';
import Input from './pages/Input';
import Activation from './pages/Activation';
import Concentration from './pages/Concentration';
import MixHealth from './pages/MixHealth';
import Efficiency from './pages/Efficiency';
import Approval from './pages/Approval';
import OperatingSystem from './pages/OperatingSystem';
import ActionPlan from './pages/ActionPlan';
import Timeline from './pages/Timeline';
import ReportCenter from './pages/ReportCenter';
import DataCenter from './pages/DataCenter';
import Dashboard from './pages/Dashboard';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Overview": Overview,
    "Input": Input,
    "Activation": Activation,
    "Concentration": Concentration,
    "MixHealth": MixHealth,
    "Efficiency": Efficiency,
    "Approval": Approval,
    "OperatingSystem": OperatingSystem,
    "ActionPlan": ActionPlan,
    "Timeline": Timeline,
    "ReportCenter": ReportCenter,
    "DataCenter": DataCenter,
    "Dashboard": Dashboard,
}

export const pagesConfig = {
    mainPage: "Overview",
    Pages: PAGES,
    Layout: __Layout,
};