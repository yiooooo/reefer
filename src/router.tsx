import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthLayout } from './layouts/AuthLayout';
import { AppLayout } from './layouts/AppLayout';
import { ProtectedRoute } from './layouts/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ReeferBonusPage } from './pages/ReeferBonusPage';
import { AdminPage } from './pages/AdminPage';
import { AccountPage } from './pages/AccountPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const router = createBrowserRouter([
  // ── Auth Routes (無 Sidebar) ─────────────────────────────────────────────
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/register',
        element: <RegisterPage />,
      },
    ],
  },

  // ── App Routes (有 Sidebar，需登入) ──────────────────────────────────────
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: '/app/reefer-bonus',
        element: <ReeferBonusPage />,
      },
      {
        path: '/app/admin',
        element: (
          <ProtectedRoute requireRole="admin">
            <AdminPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/app/account',
        element: <AccountPage />,
      },
    ],
  },

  // ── Root redirect ────────────────────────────────────────────────────────
  {
    path: '/',
    element: <Navigate to="/app/reefer-bonus" replace />,
  },

  // ── 404 ──────────────────────────────────────────────────────────────────
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
