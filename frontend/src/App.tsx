import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import {
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
} from "@/pages";

function App() {
  return (
    <BrowserRouter>
      <Routes>
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
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
