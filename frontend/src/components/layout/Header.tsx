import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Sparkles,
  Menu,
  X,
  Rss,
  FolderOpen,
  User,
  Settings,
  BookOpen,
  Bookmark,
  Brain,
  SlidersHorizontal,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

const mobileNavItems = [
  { to: "/", icon: Sparkles, label: "今日精选" },
  { to: "/feed", icon: Rss, label: "信息流" },
  { to: "/sources", icon: FolderOpen, label: "数据源" },
  { to: "/insights", icon: Brain, label: "Agent 洞察" },
  { to: "/history", icon: BookOpen, label: "阅读历史" },
  { to: "/saved", icon: Bookmark, label: "我的收藏" },
  { to: "/profile", icon: User, label: "用户画像" },
  { to: "/preferences", icon: SlidersHorizontal, label: "偏好设置" },
  { to: "/settings", icon: Settings, label: "系统设置" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  return (
    <header className="md:hidden border-b bg-card">
      <div className="flex h-14 items-center justify-between px-4">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-semibold">News Agent</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            title="退出登录"
          >
            <LogOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
      {mobileOpen && (
        <nav className="border-t p-4 space-y-1">
          {mobileNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
