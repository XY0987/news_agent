import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
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
import { Newspaper, ArrowLeft, Eye, EyeOff } from "lucide-react";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleSendCode = useCallback(async () => {
    if (!email) {
      setError("请先输入邮箱");
      return;
    }
    setCodeSending(true);
    setError("");
    try {
      await authApi.sendCode({ email, scene: "reset" });
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
      setError((e as Error).message);
    } finally {
      setCodeSending(false);
    }
  }, [email]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    if (newPassword.length < 6) {
      setError("密码至少6个字符");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword({ email, newPassword, code });
      setSuccess(true);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <span className="text-2xl">✓</span>
            </div>
            <CardTitle className="text-2xl">密码重置成功</CardTitle>
            <CardDescription>您现在可以使用新密码登录了</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => navigate("/login", { replace: true })}
            >
              前往登录
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Newspaper className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">找回密码</CardTitle>
          <CardDescription>通过邮箱验证码重置您的密码</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">验证码</Label>
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
              <Label htmlFor="newPassword">新密码</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="至少6个字符"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setError("");
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
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="再次输入新密码"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "重置中..." : "重置密码"}
            </Button>
            <div className="text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                返回登录
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
