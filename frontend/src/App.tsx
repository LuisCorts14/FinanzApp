import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import FullPageLoader from "./components/FullPageLoader";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import AccountsPage from "./pages/AccountsPage";
import AccountDetailPage from "./pages/AccountDetailPage";
import CategoriesPage from "./pages/CategoriesPage";
import MovementsPage from "./pages/MovementsPage";
import StatsPage from "./pages/StatsPage";
import SavingsGoalsPage from "./pages/SavingsGoalsPage";
import DebtsPage from "./pages/DebtsPage";
import SavingsGoalDetailPage from "./pages/SavingsGoalDetailPage";
import ScanReceiptPage from "./pages/ScanReceiptPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import "./App.css";

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <AppLayout />
    </ProtectedRoute>
  );
}

function HomeRoute() {
  const { user, loading } = useAuth();

  if (loading) return <FullPageLoader />;
  if (!user) return <LandingPage />;

  return (
    <AppLayout>
      <DashboardPage />
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/cuentas" element={<AccountsPage />} />
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
          <Route path="/movimientos" element={<MovementsPage />} />
          <Route path="/estadisticas" element={<StatsPage />} />
          <Route path="/ahorros" element={<SavingsGoalsPage />} />
          <Route path="/ahorros/:id" element={<SavingsGoalDetailPage />} />
          <Route path="/deudas" element={<DebtsPage />} />
          <Route path="/escanear" element={<ScanReceiptPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/configuracion" element={<SettingsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
