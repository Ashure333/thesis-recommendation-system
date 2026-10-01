import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AuthLayout from "./layouts/AuthLayout";
import AppLayout from "./layouts/AppLayout";

import BootSplash from "./components/retro/BootSplash";
import ScanlineOverlay from "./components/retro/ScanlineOverlay";

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

export default function App() {
  return (
    <>
      <ScanlineOverlay />
      <BootSplash />
      <BrowserRouter>
      <Routes>
        {/* Auth pages -- no top nav */}
        <Route element={<AuthLayout />}>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>

        {/* Everything after sign-in shares the top nav */}
        <Route element={<AppLayout />}>
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/repository" element={<Repository />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/library" element={<MyLibrary />} />
          <Route path="/evaluation" element={<Evaluation />} />
          <Route path="/lab" element={<Lab />} />
          <Route path="/walkthrough" element={<Walkthrough />} />
          <Route path="/walkthrough-engine" element={<MathWalkthrough />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/changelog" element={<Changelog />} />
        </Route>

        {/* Unknown paths fall back to sign-in */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </BrowserRouter>
    </>
  );
}
