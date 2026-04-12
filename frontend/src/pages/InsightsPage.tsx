import { useEffect, useState } from "react";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  Lightbulb,
  RefreshCw,
  Code,
  MessageSquare,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { agentApi } from "@/api/agent";
import { DEFAULT_USER_ID, formatDate } from "@/utils";

interface AgentSession {
  sessionId: string;
  startTime: string;
  stepCount: number;
  actions: string[];
}

interface AgentLog {
  id: string;
  sessionId: string;
  action: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  reasoning: string;
  durationMs: number;
  createdAt: string;
}

export function InsightsPage() {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [sessionLogs, setSessionLogs] = useState<Record<string, AgentLog[]>>(
    {}
  );
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await agentApi.getSessions(DEFAULT_USER_ID, 20);
      setSessions(res.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const toggleSession = async (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
      return;
    }
    setExpandedSession(sessionId);
    if (!sessionLogs[sessionId]) {
      setLoadingDetail(true);
      try {
        const res = await agentApi.getSessionDetail(sessionId);
        setSessionLogs((prev) => ({ ...prev, [sessionId]: res.data || [] }));
      } catch {
        // ignore
      } finally {
        setLoadingDetail(false);
      }
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes("fallback"))
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Agent 洞察
          </h1>
          <p className="text-muted-foreground mt-1">
            查看 Agent 执行日志和智能建议
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSessions}>
          <RefreshCw className="h-4 w-4 mr-1" />
          刷新
        </Button>
      </div>

      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">执行日志</TabsTrigger>
          <TabsTrigger value="suggestions">智能建议</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-3 mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg">暂无执行记录</p>
              <p className="text-sm mt-2">
                Agent 执行后将在此展示决策日志
              </p>
            </div>
          ) : (
            sessions.map((session) => (
              <Card key={session.sessionId}>
                <CardHeader
                  className="cursor-pointer py-3 px-4"
                  onClick={() => toggleSession(session.sessionId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {expandedSession === session.sessionId ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium text-sm">
                          会话 {session.sessionId.slice(0, 8)}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(session.startTime)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {session.stepCount} 步
                      </Badge>
                      {session.actions.some((a) => a.includes("fallback")) && (
                        <Badge variant="destructive" className="text-xs">
                          兜底
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {expandedSession === session.sessionId && (
                  <CardContent className="pt-0 px-4 pb-4">
                    {loadingDetail ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="space-y-0 border-t pt-3">
                        {(sessionLogs[session.sessionId] || []).map(
                          (log, idx) => (
                            <StepDetail
                              key={log.id || idx}
                              log={log}
                              isLast={
                                idx ===
                                (sessionLogs[session.sessionId]?.length || 0) -
                                  1
                              }
                              getActionIcon={getActionIcon}
                            />
                          )
                        )}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-3 mt-4">
          <SuggestionsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** 单步详情组件：可展开查看完整调用链路和 AI 返回内容 */
function StepDetail({
  log,
  isLast,
  getActionIcon,
}: {
  log: AgentLog;
  isLast: boolean;
  getActionIcon: (action: string) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const toolCalls = (log.input as any)?.toolCalls as any[] | undefined;
  const toolResults = (log.output as any)?.toolResults as any[] | undefined;

  return (
    <div className="flex gap-3 text-sm">
      <div className="flex flex-col items-center">
        {getActionIcon(log.action)}
        {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
      </div>
      <div className="flex-1 min-w-0 pb-4">
        {/* 标题行 */}
        <div
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
          <span className="font-medium text-xs">{log.action}</span>
          <span className="text-xs text-muted-foreground">
            {log.durationMs}ms
          </span>
          {toolCalls && toolCalls.length > 0 && (
            <Badge variant="outline" className="text-xs">
              <Wrench className="h-2.5 w-2.5 mr-1" />
              {toolCalls.length} 工具调用
            </Badge>
          )}
        </div>

        {/* AI 推理/思考（始终显示摘要，展开显示全文） */}
        {log.reasoning && (
          <div className="mt-1.5 flex items-start gap-1.5">
            <MessageSquare className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />
            <p
              className={`text-xs text-muted-foreground ${expanded ? "" : "line-clamp-2"}`}
            >
              {log.reasoning}
            </p>
          </div>
        )}

        {/* 展开后的详细内容 */}
        {expanded && (
          <div className="mt-2 space-y-2">
            {/* 工具调用列表 */}
            {toolCalls && toolCalls.length > 0 && (
              <div className="rounded-md border bg-muted/30 p-2">
                <p className="text-xs font-medium mb-1.5 flex items-center gap-1">
                  <Wrench className="h-3 w-3" />
                  工具调用
                </p>
                <div className="space-y-2">
                  {toolCalls.map((tc: any, i: number) => (
                    <div key={i} className="text-xs">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Badge variant="secondary" className="text-xs">
                          {tc.name}
                        </Badge>
                      </div>
                      {tc.arguments && (
                        <pre className="bg-background rounded p-1.5 text-xs overflow-x-auto max-h-32 border">
                          {typeof tc.arguments === "string"
                            ? tc.arguments
                            : JSON.stringify(tc.arguments, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 工具执行结果 */}
            {toolResults && toolResults.length > 0 && (
              <div className="rounded-md border bg-muted/30 p-2">
                <p className="text-xs font-medium mb-1.5 flex items-center gap-1">
                  <Code className="h-3 w-3" />
                  执行结果
                </p>
                <div className="space-y-2">
                  {toolResults.map((tr: any, i: number) => (
                    <div key={i} className="text-xs">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Badge
                          variant={
                            tr.success === false ? "destructive" : "secondary"
                          }
                          className="text-xs"
                        >
                          {tr.name || `结果 ${i + 1}`}
                        </Badge>
                        {tr.success === false && (
                          <span className="text-red-500 text-xs">失败</span>
                        )}
                      </div>
                      <pre className="bg-background rounded p-1.5 text-xs overflow-x-auto max-h-40 border whitespace-pre-wrap break-all">
                        {typeof tr.result === "string"
                          ? tr.result.length > 2000
                            ? tr.result.slice(0, 2000) + "\n... (已截断)"
                            : tr.result
                          : JSON.stringify(tr.result, null, 2)?.slice(0, 2000)}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 无工具调用时显示原始 input/output */}
            {(!toolCalls || toolCalls.length === 0) &&
              log.input &&
              Object.keys(log.input).length > 0 && (
                <div className="rounded-md border bg-muted/30 p-2">
                  <p className="text-xs font-medium mb-1 flex items-center gap-1">
                    <Code className="h-3 w-3" />
                    输入
                  </p>
                  <pre className="bg-background rounded p-1.5 text-xs overflow-x-auto max-h-40 border whitespace-pre-wrap break-all">
                    {JSON.stringify(log.input, null, 2)?.slice(0, 2000)}
                  </pre>
                </div>
              )}
            {(!toolResults || toolResults.length === 0) &&
              log.output &&
              Object.keys(log.output).length > 0 && (
                <div className="rounded-md border bg-muted/30 p-2">
                  <p className="text-xs font-medium mb-1 flex items-center gap-1">
                    <Code className="h-3 w-3" />
                    输出
                  </p>
                  <pre className="bg-background rounded p-1.5 text-xs overflow-x-auto max-h-40 border whitespace-pre-wrap break-all">
                    {JSON.stringify(log.output, null, 2)?.slice(0, 2000)}
                  </pre>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestionsList() {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const res = await agentApi.getLogs(DEFAULT_USER_ID, 50);
        const logs = res.data || [];
        // 从日志中提取建议类型的记录
        const filtered = logs.filter(
          (l: any) =>
            l.action?.includes("suggest") ||
            l.action?.includes("insight") ||
            l.action?.includes("fallback")
        );
        setSuggestions(filtered);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchSuggestions();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg">暂无建议</p>
        <p className="text-sm mt-2">
          Agent 在执行过程中发现的优化建议将在此展示
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {suggestions.map((s: any, i: number) => (
        <Card key={s.id || i}>
          <CardContent className="py-3 px-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{s.action}</p>
                {s.reasoning && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {s.reasoning}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDate(s.createdAt)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
