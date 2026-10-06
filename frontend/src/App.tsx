import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AuthLayout from "./layouts/AuthLayout";
import AppLayout from "./layouts/AppLayout";

import BootSplash from "./components/retro/BootSplash";
import ScanlineOverlay from "./components/retro/ScanlineOverlay";
import FeatureGate from "./components/FeatureGate";

import FAQ from "./pages/FAQ";
import ForgotPassword from "./pages/auth/ForgotPassword";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Repository from "./pages/repository/Repository";
import Recommendations from "./pages/evaluation/Recommendations";
import Upload from "./pages/repository/Upload";
import MyLibrary from "./pages/repository/MyLibrary";
import Evaluation from "./pages/evaluation/Evaluation";
import Lab from "./pages/lab/Lab";
import Walkthrough from "./pages/walkthrough/Walkthrough";
import MathWalkthrough from "./pages/walkthrough/MathWalkthrough";
import Changelog from "./pages/Changelog";
import LibraryHome from "./pages/home/LibraryHome";
import Admin from "./pages/admin/Admin";
import Settings from "./pages/Settings";

import { SiteModeProvider } from "./state/siteMode";

export default function App() {
  return (
    <>
      <ScanlineOverlay />
      <BootSplash />
      <BrowserRouter>
      <SiteModeProvider>
      <Routes>
        {/* Auth pages -- no top nav */}
        <Route element={<AuthLayout />}>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>

        {/* Library site editor -- its own chrome, admin login inside */}
        <Route path="/admin" element={<Admin />} />

        {/* Everything after sign-in shares the top nav */}
        <Route element={<AppLayout />}>
          <Route path="/home" element={<LibraryHome />} />
          <Route
            path="/recommendations"
            element={
              <FeatureGate feature="search">
                <Recommendations />
              </FeatureGate>
            }
          />
          <Route
            path="/repository"
            element={
              <FeatureGate feature="repository">
                <Repository />
              </FeatureGate>
            }
          />
          <Route
            path="/upload"
            element={
              <FeatureGate feature="upload">
                <Upload />
              </FeatureGate>
            }
          />
          <Route
            path="/library"
            element={
              <FeatureGate feature="library">
                <MyLibrary />
              </FeatureGate>
            }
          />
          <Route
            path="/evaluation"
            element={
              <FeatureGate feature="arena">
                <Evaluation />
              </FeatureGate>
            }
          />
          <Route
            path="/lab"
            element={
              <FeatureGate feature="lab">
                <Lab />
              </FeatureGate>
            }
          />
          <Route
            path="/walkthrough"
            element={
              <FeatureGate feature="walkthrough">
                <Walkthrough />
              </FeatureGate>
            }
          />
          <Route
            path="/walkthrough-engine"
            element={
              <FeatureGate feature="engine">
                <MathWalkthrough />
              </FeatureGate>
            }
          />
          <Route
            path="/faq"
            element={
              <FeatureGate feature="faq">
                <FAQ />
              </FeatureGate>
            }
          />
          <Route
            path="/settings"
            element={
              <FeatureGate feature="settings">
                <Settings />
              </FeatureGate>
            }
          />
          <Route
            path="/changelog"
            element={
              <FeatureGate feature="changelog">
                <Changelog />
              </FeatureGate>
            }
          />
        </Route>

        {/* Unknown paths fall back to sign-in */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </SiteModeProvider>
      </BrowserRouter>
    </>
  );
}
