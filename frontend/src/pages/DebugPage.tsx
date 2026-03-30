import { useState } from "react";
import {
  Bug,
  Play,
  Loader2,
  ChevronDown,
  ChevronRight,
  Wrench,
  Code,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Copy,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { agentApi } from "@/api/agent";
import { DEFAULT_USER_ID } from "@/utils";

interface DebugToolResult {
  toolUseId: string;
  toolName: string;
  result: unknown;
  isError: boolean;
  durationMs: number;
}

interface DebugStepData {
  step: number;
  thinking: string;
  toolCalls: { id: string; name: string; args: Record<string, unknown> }[];
  toolResults: DebugToolResult[];
  durationMs: number;
}

interface DebugResult {
  sessionId: string;
  systemPrompt: string;
  userMessage: string;
  steps: DebugStepData[];
  stepsUsed: number;
  totalDurationMs: number;
  report: string;
  isSuccess: boolean;
}

export function DebugPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [maxArticles, setMaxArticles] = useState(10);
  const [skipPush, setSkipPush] = useState(true);

  const runDebug = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await agentApi.debugWechat(DEFAULT_USER_ID, {
        maxArticles,
        skipPush,
      });
      setResult(res.data);
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : "请求失败，请检查后端是否运行";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bug className="h-6 w-6 text-orange-500" />
          调试工具
        </h1>
        <p className="text-muted-foreground mt-1">
          调试微信公众号采集的完整 Agent Loop，查看每一步的输入、输出和工具调用
        </p>
      </div>

      {/* 控制面板 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">运行配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">最大采集文章数</label>
              <input
                type="number"
                min={1}
                max={50}
                value={maxArticles}
                onChange={(e) =>
                  setMaxArticles(Math.max(1, parseInt(e.target.value) || 10))
                }
                className="flex h-9 w-24 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={skipPush}
                  onChange={(e) => setSkipPush(e.target.checked)}
                  className="rounded"
                />
                跳过推送（不发邮件）
              </label>
            </div>
            <Button
              onClick={runDebug}
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Agent 执行中…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  开始调试
                </>
              )}
            </Button>
          </div>
          {loading && (
            <p className="text-sm text-muted-foreground">
              Agent Loop 正在执行，这可能需要几分钟时间，请耐心等待…
            </p>
          )}
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">执行失败</span>
            </div>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* 结果展示 */}
      {result && (
        <div className="space-y-4">
          {/* 概览 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {result.isSuccess ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                执行概览
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Session ID</p>
                  <p className="font-mono text-xs">
                    {result.sessionId.slice(0, 12)}…
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">执行步数</p>
                  <p className="font-semibold">{result.stepsUsed} 步</p>
                </div>
                <div>
                  <p className="text-muted-foreground">总耗时</p>
                  <p className="font-semibold">
                    {(result.totalDurationMs / 1000).toFixed(1)}s
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">状态</p>
                  <Badge
                    variant={result.isSuccess ? "default" : "destructive"}
                  >
                    {result.isSuccess ? "成功" : "失败"}
                  </Badge>
                </div>
              </div>
              {result.report && (
                <div className="mt-4 p-3 bg-muted/50 rounded-md">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    最终报告
                  </p>
                  <p className="text-sm whitespace-pre-wrap">
                    {result.report}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* System Prompt */}
          <CollapsibleSection
            title="System Prompt"
            icon={<FileText className="h-4 w-4 text-blue-500" />}
            defaultOpen={false}
          >
            <pre className="text-xs whitespace-pre-wrap break-words bg-background rounded-md p-3 border max-h-96 overflow-auto">
              {result.systemPrompt}
            </pre>
          </CollapsibleSection>

          {/* User Message */}
          <CollapsibleSection
            title="User Message"
            icon={<MessageSquare className="h-4 w-4 text-green-500" />}
            defaultOpen={false}
          >
            <pre className="text-xs whitespace-pre-wrap break-words bg-background rounded-md p-3 border">
              {result.userMessage}
            </pre>
          </CollapsibleSection>

          {/* 逐步详情 */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">执行步骤</h2>
            {result.steps.map((step) => (
              <DebugStepCard key={step.step} step={step} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** 可折叠区块 */
function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <CardHeader
        className="py-3 px-4 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          {icon}
          <span className="font-medium text-sm">{title}</span>
        </div>
      </CardHeader>
      {open && <CardContent className="pt-0 px-4 pb-4">{children}</CardContent>}
    </Card>
  );
}

/** 单步调试详情卡片 */
function DebugStepCard({ step }: { step: DebugStepData }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card>
      <CardHeader
        className="py-3 px-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <Badge variant="outline" className="font-mono">
              Step {step.step}
            </Badge>
            {step.toolCalls.length > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Wrench className="h-3 w-3" />
                {step.toolCalls.length} 工具调用
              </Badge>
            )}
            {step.toolResults.some((tr) => tr.isError) && (
              <Badge variant="destructive">有错误</Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {(step.durationMs / 1000).toFixed(1)}s
          </span>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 px-4 pb-4 space-y-3">
          {/* LLM 思考 */}
          {step.thinking && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <MessageSquare className="h-3 w-3 text-blue-500" />
                LLM 思考
              </p>
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-md p-3 border border-blue-200 dark:border-blue-800">
                <p className="text-sm whitespace-pre-wrap">{step.thinking}</p>
              </div>
            </div>
          )}

          {/* 工具调用 */}
          {step.toolCalls.map((tc, i) => {
            const tr = step.toolResults.find((r) => r.toolUseId === tc.id);
            return (
              <div key={tc.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Wrench className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-sm font-medium">
                    工具调用 #{i + 1}
                  </span>
                  <Badge variant="secondary">{tc.name}</Badge>
                  {tr && (
                    <span className="text-xs text-muted-foreground">
                      {(tr.durationMs / 1000).toFixed(1)}s
                    </span>
                  )}
                  {tr?.isError && (
                    <Badge variant="destructive" className="text-xs">
                      失败
                    </Badge>
                  )}
                </div>

                {/* 输入参数 */}
                <CopyableCodeBlock
                  label="输入参数"
                  content={JSON.stringify(tc.args, null, 2)}
                />

                {/* 输出结果 */}
                {tr && (
                  <CopyableCodeBlock
                    label="执行结果"
                    content={
                      typeof tr.result === "string"
                        ? tr.result
                        : JSON.stringify(tr.result, null, 2)
                    }
                    isError={tr.isError}
                  />
                )}
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}

/** 带复制按钮的代码块 */
function CopyableCodeBlock({
  label,
  content,
  isError = false,
}: {
  label: string;
  content: string;
  isError?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Code className="h-3 w-3" />
          {label}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
      <pre
        className={`text-xs whitespace-pre-wrap break-all rounded-md p-3 border max-h-96 overflow-auto ${
          isError
            ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
            : "bg-muted/50"
        }`}
      >
        {content}
      </pre>
    </div>
  );
}
