import { useEffect, useState } from "react";
import { useSkillStore } from "@/store";
import { DEFAULT_USER_ID } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Play,
  RefreshCw,
  Clock,
  Zap,
  Hand,
  CheckCircle2,
  XCircle,
  Loader2,
  Settings2,
  History,
  Download,
  Trash2,
  GitBranch,
} from "lucide-react";
import type { Skill, SkillDetail, SkillExecution } from "@/types";
import { formatDate } from "@/utils";

/** 触发类型中文名 */
function getTriggerTypeName(type: string): string {
  const map: Record<string, string> = {
    schedule: "定时触发",
    manual: "手动触发",
    event: "事件触发",
    keyword: "关键词触发",
  };
  return map[type] || type;
}

/** 触发类型图标 */
function TriggerIcon({ type }: { type: string }) {
  switch (type) {
    case "schedule":
      return <Clock className="h-4 w-4" />;
    case "manual":
      return <Hand className="h-4 w-4" />;
    case "event":
      return <Zap className="h-4 w-4" />;
    default:
      return <Zap className="h-4 w-4" />;
  }
}

/** 状态徽章 */
function StatusBadge({ status }: { status: Skill["status"] }) {
  switch (status) {
    case "enabled":
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          已启用
        </Badge>
      );
    case "disabled":
      return (
        <Badge variant="secondary" className="text-gray-500">
          已禁用
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-gray-400">
          未配置
        </Badge>
      );
  }
}

/** 执行状态徽章 */
function ExecStatusBadge({ status }: { status: SkillExecution["status"] }) {
  switch (status) {
    case "success":
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          成功
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          失败
        </Badge>
      );
    case "running":
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          运行中
        </Badge>
      );
  }
}

// ==================== Skill 卡片组件 ====================

function SkillCard({
  skill,
  onToggle,
  onRun,
  onDetail,
}: {
  skill: Skill;
  onToggle: (skillId: string, enabled: boolean) => void;
  onRun: (skillId: string) => void;
  onDetail: (skillId: string) => void;
}) {
  return (
    <Card className="group hover:shadow-md transition-shadow cursor-pointer">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div
            className="flex items-center gap-3"
            onClick={() => onDetail(skill.id)}
          >
            <span className="text-2xl">{skill.icon || "🔧"}</span>
            <div>
              <CardTitle className="text-base">{skill.name}</CardTitle>
              <CardDescription className="text-xs mt-1">
                v{skill.version}
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={skill.status === "enabled"}
            onCheckedChange={(checked) => onToggle(skill.id, checked)}
          />
        </div>
      </CardHeader>
      <CardContent onClick={() => onDetail(skill.id)}>
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {skill.description}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <TriggerIcon type={skill.triggerType} />
              <span className="ml-1">
                {getTriggerTypeName(skill.triggerType)}
              </span>
            </Badge>
            {skill.tags?.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            disabled={skill.status !== "enabled"}
            onClick={(e) => {
              e.stopPropagation();
              onRun(skill.id);
            }}
          >
            <Play className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== Skill 详情弹窗 ====================

function SkillDetailDialog({
  open,
  onClose,
  detail,
  executions,
  onRun,
  loading,
  executing,
}: {
  open: boolean;
  onClose: () => void;
  detail: SkillDetail | null;
  executions: SkillExecution[];
  onRun: () => void;
  loading: boolean;
  executing: boolean;
}) {
  if (!detail) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{detail.icon || "🔧"}</span>
            <div>
              <DialogTitle className="text-xl">{detail.name}</DialogTitle>
              <DialogDescription>
                v{detail.version} · {detail.category || "未分类"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="info" className="mt-4">
          <TabsList>
            <TabsTrigger value="info">基本信息</TabsTrigger>
            <TabsTrigger value="settings">
              <Settings2 className="h-3.5 w-3.5 mr-1" />
              配置
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-3.5 w-3.5 mr-1" />
              执行记录
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            <div>
              <h4 className="text-sm font-medium mb-2">描述</h4>
              <p className="text-sm text-muted-foreground">
                {detail.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium mb-2">触发方式</h4>
                <div className="flex items-center gap-2">
                  <TriggerIcon type={detail.triggerType} />
                  <span className="text-sm">
                    {getTriggerTypeName(detail.triggerType)}
                  </span>
                  {detail.trigger?.schedule?.cron && (
                    <Badge variant="outline" className="text-xs">
                      {detail.trigger.schedule.cron}
                    </Badge>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Agent 配置</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>最大步数: {detail.agent?.maxSteps || "默认"}</div>
                  <div>温度: {detail.agent?.temperature ?? "默认"}</div>
                  <div>超时: {detail.agent?.timeout || "默认"}s</div>
                </div>
              </div>
            </div>

            {detail.tools?.include && detail.tools.include.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">使用工具</h4>
                <div className="flex flex-wrap gap-1.5">
                  {detail.tools.include.map((tool) => (
                    <Badge
                      key={tool}
                      variant="secondary"
                      className="text-xs font-mono"
                    >
                      {tool}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {detail.tags && detail.tags.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">标签</h4>
                <div className="flex gap-2">
                  {detail.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <Button
                onClick={onRun}
                disabled={executing || detail.userConfig.status !== "enabled"}
              >
                {executing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {executing ? "执行中..." : "手动执行"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            {detail.settingDefinitions &&
            detail.settingDefinitions.length > 0 ? (
              <div className="space-y-4">
                {detail.settingDefinitions.map((def) => (
                  <div
                    key={def.key}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">{def.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {def.key} ({def.type})
                      </p>
                    </div>
                    <div className="text-sm text-right">
                      <span className="text-muted-foreground">当前值: </span>
                      <span className="font-medium">
                        {String(
                          detail.userConfig.settings[def.key] ??
                            def.default ??
                            "未设置"
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                此 Skill 没有可配置项
              </p>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {executions.length > 0 ? (
              <div className="space-y-3">
                {executions.map((exec) => (
                  <div
                    key={exec.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <ExecStatusBadge status={exec.status} />
                      <div>
                        <p className="text-sm font-mono text-muted-foreground">
                          {exec.sessionId.slice(0, 8)}...
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(exec.startedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div>{exec.stepsCount} 步</div>
                      <div>
                        {exec.durationMs > 0
                          ? `${(exec.durationMs / 1000).toFixed(1)}s`
                          : "-"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                暂无执行记录
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ==================== 安装 Skill 弹窗 ====================

function InstallSkillDialog({
  open,
  onClose,
  onInstalled,
}: {
  open: boolean;
  onClose: () => void;
  onInstalled: () => void;
}) {
  const { installSkill, installing } = useSkillStore();
  const [gitUrl, setGitUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [directory, setDirectory] = useState("");
  const [error, setError] = useState("");

  const handleInstall = async () => {
    if (!gitUrl.trim()) {
      setError("请输入 Git 仓库地址");
      return;
    }
    if (!gitUrl.startsWith("https://")) {
      setError("只支持 HTTPS 协议的 Git 地址");
      return;
    }
    setError("");

    try {
      await installSkill({
        gitUrl: gitUrl.trim(),
        branch: branch.trim() || "main",
        directory: directory.trim() || undefined,
      });
      // 安装成功
      setGitUrl("");
      setBranch("main");
      setDirectory("");
      onClose();
      onInstalled();
    } catch (e: unknown) {
      setError((e as Error).message || "安装失败");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />从 Git 安装 Skill
          </DialogTitle>
          <DialogDescription>
            填写 Git 仓库地址，系统会自动 clone 并注册 Skill
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="gitUrl">Git 仓库地址 *</Label>
            <Input
              id="gitUrl"
              placeholder="https://github.com/user/skill-repo.git"
              value={gitUrl}
              onChange={(e) => setGitUrl(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="branch">分支</Label>
              <Input
                id="branch"
                placeholder="main"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="directory">仓库内目录</Label>
              <Input
                id="directory"
                placeholder="skills/my-skill（可选）"
                value={directory}
                onChange={(e) => setDirectory(e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            仓库内目录：如果 SKILL.md
            不在仓库根目录，请填写子目录路径。留空表示仓库根目录。
          </p>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={installing}>
              取消
            </Button>
            <Button onClick={handleInstall} disabled={installing}>
              {installing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {installing ? "安装中..." : "安装"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== 主页面 ====================

export function SkillsPage() {
  const {
    skills,
    selectedSkill,
    executions,
    loading,
    executing,
    fetchSkills,
    fetchSkillDetail,
    enableSkill,
    disableSkill,
    runSkill,
    fetchExecutions,
    reloadSkills,
  } = useSkillStore();

  const [detailOpen, setDetailOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    fetchSkills(DEFAULT_USER_ID);
  }, [fetchSkills]);

  const handleToggle = async (skillId: string, enabled: boolean) => {
    if (enabled) {
      await enableSkill(skillId, DEFAULT_USER_ID);
    } else {
      await disableSkill(skillId, DEFAULT_USER_ID);
    }
  };

  const handleRun = async (skillId: string) => {
    try {
      await runSkill(skillId, DEFAULT_USER_ID);
    } catch {
      // error 已由 store 处理
    }
  };

  const handleDetail = async (skillId: string) => {
    await fetchSkillDetail(skillId, DEFAULT_USER_ID);
    await fetchExecutions(DEFAULT_USER_ID, skillId);
    setDetailOpen(true);
  };

  const handleReload = async () => {
    await reloadSkills();
    await fetchSkills(DEFAULT_USER_ID);
  };

  // 按 tab 筛选
  const filteredSkills =
    activeTab === "all"
      ? skills
      : activeTab === "enabled"
      ? skills.filter((s) => s.status === "enabled")
      : activeTab === "schedule"
      ? skills.filter((s) => s.triggerType === "schedule")
      : skills.filter((s) => s.triggerType === "manual");

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Skills 技能管理</h1>
          <p className="text-muted-foreground mt-1">
            管理 Agent 的可插拔技能，为你的信息管家扩展新能力
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setInstallOpen(true)}>
            <Download className="h-4 w-4 mr-2" />
            安装 Skill
          </Button>
          <Button variant="outline" onClick={handleReload}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{skills.length}</div>
            <p className="text-sm text-muted-foreground">全部 Skills</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {skills.filter((s) => s.status === "enabled").length}
            </div>
            <p className="text-sm text-muted-foreground">已启用</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {skills.filter((s) => s.triggerType === "schedule").length}
            </div>
            <p className="text-sm text-muted-foreground">定时任务</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">
              {skills.filter((s) => s.triggerType === "manual").length}
            </div>
            <p className="text-sm text-muted-foreground">手动触发</p>
          </CardContent>
        </Card>
      </div>

      {/* Skills 列表 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="enabled">已启用</TabsTrigger>
          <TabsTrigger value="schedule">定时任务</TabsTrigger>
          <TabsTrigger value="manual">手动触发</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg mb-2">暂无 Skills</p>
              <p className="text-sm">
                在{" "}
                <code className="bg-muted px-1 rounded">backend/skills/</code>{" "}
                目录中创建 SKILL.md 来添加新技能
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSkills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onToggle={handleToggle}
                  onRun={handleRun}
                  onDetail={handleDetail}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 详情弹窗 */}
      <SkillDetailDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        detail={selectedSkill}
        executions={executions}
        onRun={() => selectedSkill && handleRun(selectedSkill.id)}
        loading={loading}
        executing={executing}
      />

      {/* 安装弹窗 */}
      <InstallSkillDialog
        open={installOpen}
        onClose={() => setInstallOpen(false)}
        onInstalled={() => fetchSkills(DEFAULT_USER_ID)}
      />
    </div>
  );
}
