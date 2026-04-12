import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { authApi } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Newspaper, Eye, EyeOff } from "lucide-react";

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, loading, error, clearError } = useAuthStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [localError, setLocalError] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleSendCode = useCallback(async () => {
    if (!email) {
      setLocalError("请先输入邮箱");
      return;
    }
    setCodeSending(true);
    setLocalError("");
    try {
      await authApi.sendCode({ email, scene: "register" });
      setCountdown(60);
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e: unknown) {
      setLocalError((e as Error).message);
    } finally {
      setCodeSending(false);
    }
  }, [email]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError("");

    if (password !== confirmPassword) {
      setLocalError("两次输入的密码不一致");
      return;
    }
    if (password.length < 6) {
      setLocalError("密码至少6个字符");
      return;
    }

    try {
      await register(name, email, password, code);
      navigate("/", { replace: true });
    } catch {
      // error is set in store
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Newspaper className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">注册 News Agent</CardTitle>
          <CardDescription>创建账号开始使用智能新闻聚合服务</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {displayError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {displayError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">用户名</Label>
              <Input
                id="name"
                placeholder="你的昵称"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearError();
                  setLocalError("");
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError();
                  setLocalError("");
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">邮箱验证码</Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  placeholder="6位数字验证码"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={6}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 w-28"
                  disabled={codeSending || countdown > 0 || !email}
                  onClick={handleSendCode}
                >
                  {countdown > 0
                    ? `${countdown}s`
                    : codeSending
                      ? "发送中..."
                      : "获取验证码"}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="至少6个字符"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearError();
                    setLocalError("");
                  }}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="再次输入密码"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setLocalError("");
                }}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "注册中..." : "注册"}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              已有账号？{" "}
              <Link
                to="/login"
                className="text-primary hover:underline"
              >
                立即登录
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
