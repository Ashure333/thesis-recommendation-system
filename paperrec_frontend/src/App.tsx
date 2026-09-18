import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AuthLayout from "./layouts/AuthLayout";
import AppLayout from "./layouts/AppLayout";

import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Search from "./pages/main/Search";
import Repository from "./pages/repository/Repository";
import Recommendations from "./pages/evaluation/Recommendations";
import Upload from "./pages/repository/Upload";
import MyLibrary from "./pages/repository/MyLibrary";
import Evaluation from "./pages/evaluation/Evaluation";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth pages -- no top nav */}
        <Route element={<AuthLayout />}>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Everything after sign-in shares the top nav */}
        <Route element={<AppLayout />}>
          <Route path="/search" element={<Search />} />
          <Route path="/repository" element={<Repository />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/library" element={<MyLibrary />} />
          <Route path="/evaluation" element={<Evaluation />} />
        </Route>

        {/* Unknown paths fall back to sign-in */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
