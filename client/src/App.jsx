// client/src/App.jsx
// App component defining router hierarchy, route-level code splitting, and protected route boundaries

import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';

// Static imports for entry / landing pages
import HomePage from '@/pages/HomePage';
import AuthPage from '@/pages/AuthPage';

// Lazy-loaded pages for route-level code splitting
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ProfileDetailPage = lazy(() => import('@/pages/ProfileDetailPage'));
const ChatPage = lazy(() => import('@/pages/ChatPage'));
const ReviewsPage = lazy(() => import('@/pages/ReviewsPage'));
const ProfileSetupPage = lazy(() => import('@/pages/ProfileSetupPage'));
const EventsPage = lazy(() => import('@/pages/EventsPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

// Fallback spinner matching existing ProtectedRoute design
function PageFallback() {
  return (
    <div
      className="flex-1 min-h-[60vh] flex flex-col items-center justify-center p-8 text-slate-500"
      role="status"
      aria-label="Loading page"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600 mb-4" />
      <span className="text-sm font-medium">Loading...</span>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* Public pages */}
          <Route index element={<HomePage />} />
          <Route path="auth" element={<AuthPage />} />

          {/* Protected core pages */}
          <Route
            path="dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile/:id"
            element={
              <ProtectedRoute>
                <ProfileDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="reviews"
            element={
              <ProtectedRoute>
                <ReviewsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile/setup"
            element={
              <ProtectedRoute>
                <ProfileSetupPage />
              </ProtectedRoute>
            }
          />

          {/* Events Page */}
          <Route path="events" element={<EventsPage />} />

          {/* Legal Pages */}
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />

          {/* 404 Catch-All */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
