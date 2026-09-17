import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './admin/AdminLayout';
import Dashboard from './admin/Dashboard';
import Matches from './admin/Matches';
import Teams from './admin/Teams';
import Participants from './admin/Participants';
import PublicLayout from './public/PublicLayout';
import Home from './public/Home';
import Classification from './public/Classification';
import MatchesPage from './public/MatchesPage';
import TeamsPage from './public/TeamsPage';
import TeamDetail from './public/TeamDetail';
import StreamsPage from './public/StreamsPage';
import StatsPage from './public/StatsPage';
import CreatorOverlay from './broadcast/CreatorOverlay';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/broadcast/creator/:slug" element={<CreatorOverlay />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="matches" element={<Matches />} />
          <Route path="teams" element={<Teams />} />
          <Route path="participants" element={<Participants />} />
        </Route>
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="classification" element={<Classification />} />
          <Route path="matches" element={<MatchesPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="teams/:slug" element={<TeamDetail />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="statistics" element={<Navigate to="/stats" replace />} />
          <Route path="streams" element={<StreamsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
