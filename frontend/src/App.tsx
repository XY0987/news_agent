import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuthStore } from "@/store/auth";
import {
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  HomePage,
  FeedPage,
  SourcesPage,
  AddSourcePage,
  ProfilePage,
  PreferencesPage,
  HistoryPage,
  SavedPage,
  InsightsPage,
  SettingsPage,
  SkillsPage,
  DebugPage,
} from "@/pages";

function App() {
  const initAuth = useAuthStore((s) => s.initAuth);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <BrowserRouter>
      <Routes>
        {/* 公开路由 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* 需要认证的路由 */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/sources" element={<SourcesPage />} />
            <Route path="/sources/add" element={<AddSourcePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/preferences" element={<PreferencesPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/skills" element={<SkillsPage />} />
            <Route path="/debug" element={<DebugPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
