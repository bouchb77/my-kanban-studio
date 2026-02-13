import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { MainLayout } from "./components/MainLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import KanbanPage from "./pages/KanbanPage";
import TasksPage from "./pages/TasksPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import ReportingPage from "./pages/ReportingPage";
import { CalendarPage } from "./pages/CalendarPage";
import NotificationsPage from "./pages/NotificationsPage";
import NotFound from "./pages/NotFound";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import CompaniesPage from "./pages/CompaniesPage";
import ImportReportingPage from "./pages/ImportReportingPage";
import PublicReportingPage from "./pages/PublicReportingPage";
import IsochronePage from "./pages/IsochronePage";
import IsochroneDEPage from "./pages/IsochroneDEPage";
import CompaniesDEPage from "./pages/CompaniesDEPage";
import UserApprovalPage from "./pages/UserApprovalPage";
import BilanFormateurPage from "./pages/BilanFormateurPage";
import SalonPage from "./pages/SalonPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<LoginPage />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <MainLayout><DashboardPage /></MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/kanban" 
              element={
                <ProtectedRoute>
                  <MainLayout><KanbanPage /></MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/tasks" 
              element={
                <ProtectedRoute>
                  <MainLayout><TasksPage /></MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/calendar" 
              element={
                <ProtectedRoute>
                  <MainLayout><CalendarPage /></MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <MainLayout><SettingsPage /></MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <MainLayout><ProfilePage /></MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reporting" 
              element={
                <ProtectedRoute>
                  <MainLayout><ReportingPage /></MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/public-reporting" 
              element={
                <ProtectedRoute>
                  <MainLayout><PublicReportingPage /></MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/notifications" 
              element={
                <ProtectedRoute>
                  <MainLayout><NotificationsPage /></MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/projects" 
              element={
                <ProtectedRoute>
                  <MainLayout><ProjectsPage /></MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/projects/:id" 
              element={
                <ProtectedRoute>
                  <MainLayout><ProjectDetailPage /></MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/companies" 
              element={
                <ProtectedRoute>
                  <MainLayout><CompaniesPage /></MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/import-reporting" 
              element={
                <ProtectedRoute>
                  <MainLayout><ImportReportingPage /></MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/isochrone" 
              element={
                <ProtectedRoute>
                  <MainLayout><IsochronePage /></MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/salon" 
              element={
                <ProtectedRoute>
                  <MainLayout><SalonPage /></MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/isochrone-de" 
              element={
                <ProtectedRoute>
                  <MainLayout><IsochroneDEPage /></MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/companies-de" 
              element={
                <ProtectedRoute>
                  <MainLayout><CompaniesDEPage /></MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/users" 
              element={
                <ProtectedRoute>
                  <MainLayout><UserApprovalPage /></MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/bilan-formateur" 
              element={
                <ProtectedRoute>
                  <MainLayout><BilanFormateurPage /></MainLayout>
                </ProtectedRoute>
              } 
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
