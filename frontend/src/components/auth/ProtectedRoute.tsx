import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/auth";

/**
 * 路由守卫：包裹需要认证的路由
 * 未登录时重定向到登录页
 */
export function ProtectedRoute() {
  const { token, initialized } = useAuthStore();

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
