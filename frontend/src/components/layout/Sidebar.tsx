import { NavLink } from "react-router-dom";
import {
  Sparkles,
  Rss,
  FolderOpen,
  User,
  Settings,
  BookOpen,
  Bookmark,
  Brain,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { to: "/", icon: Sparkles, label: "今日精选" },
  { to: "/feed", icon: Rss, label: "信息流" },
  { to: "/sources", icon: FolderOpen, label: "数据源" },
  { to: "/insights", icon: Brain, label: "Agent 洞察" },
];

const secondaryItems = [
  { to: "/history", icon: BookOpen, label: "阅读历史" },
  { to: "/saved", icon: Bookmark, label: "我的收藏" },
];

const settingItems = [
  { to: "/profile", icon: User, label: "用户画像" },
  { to: "/preferences", icon: SlidersHorizontal, label: "偏好设置" },
  { to: "/settings", icon: Settings, label: "系统设置" },
];

function NavItem({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent",
          isActive
            ? "bg-accent text-accent-foreground font-medium"
            : "text-muted-foreground"
        )
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-6">
        <Sparkles className="h-5 w-5 text-primary mr-2" />
        <span className="font-semibold text-lg">News Agent</span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </div>
        <Separator className="my-3" />
        <div className="space-y-1">
          {secondaryItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </div>
        <Separator className="my-3" />
        <div className="space-y-1">
          <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            设置
          </p>
          {settingItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </div>
      </nav>
    </aside>
  );
}
