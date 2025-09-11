import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  List,
  Settings,
  BarChart3,
  Bell,
  CheckSquare,
  User,
  Calendar,
} from "lucide-react";

const navigationItems = [
  { title: "Tableau de bord", url: "/dashboard", icon: LayoutDashboard },
  { title: "Kanban", url: "/kanban", icon: CheckSquare },
  { title: "Liste des tâches", url: "/tasks", icon: List },
  { title: "Agenda Outlook", url: "/calendar", icon: Calendar },
  { title: "Reporting", url: "/reporting", icon: BarChart3 },
  { title: "Notifications", url: "/notifications", icon: Bell },
];

const settingsItems = [
  { title: "Paramètres", url: "/settings", icon: Settings },
  { title: "Profil", url: "/profile", icon: User },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"}>
      <SidebarContent className="bg-sidebar-background border-r border-sidebar-border text-sidebar-foreground">
        {/* Header with logo */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden">
              <img src="/lovable-uploads/ada61702-74b1-4eb4-b110-1b1f2897a2d4.png" alt="TaskFlow Logo" className="w-full h-full object-contain" />
            </div>
            {!collapsed && (
              <div>
                <h2 className="font-semibold text-sidebar-foreground">TaskFlow</h2>
                <p className="text-xs text-sidebar-foreground/70">Gestion de tâches</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation principale */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url}>
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Paramètres */}
        <SidebarGroup>
          <SidebarGroupLabel>Compte</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url}>
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}