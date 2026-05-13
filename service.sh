#!/bin/bash
set -e

NETWORK_NAME="news_agent_net"
MYSQL_CONTAINER="mysql-container"
REDIS_CONTAINER="redis-container"
ENV_FILE="$(cd "$(dirname "$0")" && pwd)/backend/.env"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 将 .env 中的 HOST/PORT 替换为 Docker 容器内部值（Docker 内部通过容器名+内部端口互访）
patch_env_for_docker() {
  if [ ! -f "$ENV_FILE" ]; then
    echo -e "  ${YELLOW}.env 文件不存在: $ENV_FILE${NC}"
    return
  fi

  echo -e "${GREEN}=== 配置 .env 用于 Docker 内部网络 ===${NC}"

  # 备份原始值（仅在还没备份时才备份）
  if [ ! -f "${ENV_FILE}.hostbak" ]; then
    grep -E '^DATABASE_HOST=' "$ENV_FILE" | head -1 > "${ENV_FILE}.hostbak"
    grep -E '^REDIS_HOST=' "$ENV_FILE" | head -1 >> "${ENV_FILE}.hostbak"
    grep -E '^REDIS_PORT=' "$ENV_FILE" | head -1 >> "${ENV_FILE}.hostbak"
    echo "  已备份原始配置到 ${ENV_FILE}.hostbak"
  fi

  # 用 sed 替换为 Docker 内部值
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/^DATABASE_HOST=.*/DATABASE_HOST=${MYSQL_CONTAINER}/" "$ENV_FILE"
    sed -i '' "s/^REDIS_HOST=.*/REDIS_HOST=${REDIS_CONTAINER}/" "$ENV_FILE"
    sed -i '' "s/^REDIS_PORT=.*/REDIS_PORT=6379/" "$ENV_FILE"
  else
    sed -i "s/^DATABASE_HOST=.*/DATABASE_HOST=${MYSQL_CONTAINER}/" "$ENV_FILE"
    sed -i "s/^REDIS_HOST=.*/REDIS_HOST=${REDIS_CONTAINER}/" "$ENV_FILE"
    sed -i "s/^REDIS_PORT=.*/REDIS_PORT=6379/" "$ENV_FILE"
  fi

  echo "  DATABASE_HOST -> ${MYSQL_CONTAINER}"
  echo "  REDIS_HOST    -> ${REDIS_CONTAINER}"
  echo "  REDIS_PORT    -> 6379"
}

# 从备份恢复原始配置
restore_env() {
  if [ -f "${ENV_FILE}.hostbak" ]; then
    echo -e "${GREEN}=== 恢复 .env 原始配置 ===${NC}"
    local orig_db_host orig_redis_host orig_redis_port
    orig_db_host=$(grep '^DATABASE_HOST=' "${ENV_FILE}.hostbak" | head -1)
    orig_redis_host=$(grep '^REDIS_HOST=' "${ENV_FILE}.hostbak" | head -1)
    orig_redis_port=$(grep '^REDIS_PORT=' "${ENV_FILE}.hostbak" | head -1)

    if [[ "$OSTYPE" == "darwin"* ]]; then
      [ -n "$orig_db_host" ] && sed -i '' "s/^DATABASE_HOST=.*/${orig_db_host}/" "$ENV_FILE" && echo "  已恢复 $orig_db_host"
      [ -n "$orig_redis_host" ] && sed -i '' "s/^REDIS_HOST=.*/${orig_redis_host}/" "$ENV_FILE" && echo "  已恢复 $orig_redis_host"
      [ -n "$orig_redis_port" ] && sed -i '' "s/^REDIS_PORT=.*/${orig_redis_port}/" "$ENV_FILE" && echo "  已恢复 $orig_redis_port"
    else
      [ -n "$orig_db_host" ] && sed -i "s/^DATABASE_HOST=.*/${orig_db_host}/" "$ENV_FILE" && echo "  已恢复 $orig_db_host"
      [ -n "$orig_redis_host" ] && sed -i "s/^REDIS_HOST=.*/${orig_redis_host}/" "$ENV_FILE" && echo "  已恢复 $orig_redis_host"
      [ -n "$orig_redis_port" ] && sed -i "s/^REDIS_PORT=.*/${orig_redis_port}/" "$ENV_FILE" && echo "  已恢复 $orig_redis_port"
    fi

    rm -f "${ENV_FILE}.hostbak"
  fi
}

usage() {
  echo "用法: $0 [命令] [服务]"
  echo ""
  echo "命令:"
  echo "  start       首次启动（默认，等同于不带参数）"
  echo "  restart     重启服务（重新构建并启动）"
  echo "  stop        停止服务"
  echo "  status      查看服务状态"
  echo "  logs        查看日志（可指定服务）"
  echo ""
  echo "服务（可选，默认为 all）:"
  echo "  all         前端 + 后端"
  echo "  frontend    仅前端"
  echo "  backend     仅后端（api）"
  echo ""
  echo "示例:"
  echo "  $0                    # 首次启动全部"
  echo "  $0 restart            # 重启全部（重新构建）"
  echo "  $0 restart backend    # 仅重启后端"
  echo "  $0 restart frontend   # 仅重启前端"
  echo "  $0 stop               # 停止全部"
  echo "  $0 logs backend       # 查看后端日志"
  exit 1
}

# 解析服务名：frontend -> frontend, backend -> api, all -> frontend api
resolve_services() {
  local target="${1:-all}"
  case "$target" in
    frontend)
      echo "frontend"
      ;;
    backend|api)
      echo "api"
      ;;
    all|"")
      echo "frontend api"
      ;;
    *)
      echo -e "${RED}未知服务: $target${NC}" >&2
      usage
      ;;
  esac
}

ensure_infra() {
  echo -e "${GREEN}=== 确保基础设施已启动 ===${NC}"
  docker start $MYSQL_CONTAINER 2>/dev/null || echo -e "  ${YELLOW}MySQL 容器未创建，请先创建${NC}"
  docker start $REDIS_CONTAINER 2>/dev/null || echo -e "  ${YELLOW}Redis 容器未创建，请先创建${NC}"

  echo -e "${GREEN}=== 等待 MySQL 就绪 ===${NC}"
  for i in $(seq 1 10); do
    if docker exec $MYSQL_CONTAINER mysqladmin ping -h 127.0.0.1 --silent 2>/dev/null; then
      echo "  MySQL 已就绪"
      break
    fi
    echo "  等待 MySQL 启动中... ($i/10)"
    sleep 2
  done
}

ensure_network() {
  echo -e "${GREEN}=== 将外部容器加入共享网络 ===${NC}"
  # MySQL
  if docker network inspect $NETWORK_NAME 2>/dev/null | grep -q "$MYSQL_CONTAINER"; then
    echo "  MySQL 已在网络中，跳过"
  else
    docker network connect $NETWORK_NAME $MYSQL_CONTAINER && echo "  MySQL 已加入网络" || echo -e "  ${YELLOW}MySQL 加入网络失败${NC}"
  fi

  # Redis
  if docker network inspect $NETWORK_NAME 2>/dev/null | grep -q "$REDIS_CONTAINER"; then
    echo "  Redis 已在网络中，跳过"
  else
    docker network connect $NETWORK_NAME $REDIS_CONTAINER && echo "  Redis 已加入网络" || echo -e "  ${YELLOW}Redis 加入网络失败${NC}"
  fi
}

do_start() {
  local services=$(resolve_services "$1")
  ensure_infra

  # 将 .env 中的 HOST 替换为容器名，以便 Docker 内部互访
  patch_env_for_docker

  # 先创建网络（如果不存在），再将外部容器加入网络
  docker network create $NETWORK_NAME 2>/dev/null || true
  ensure_network

  echo -e "${GREEN}=== 启动服务: $services ===${NC}"
  docker-compose up -d --build $services

  echo -e "${GREEN}=== 启动完成 ===${NC}"
  docker-compose ps
}

do_restart() {
  local services=$(resolve_services "$1")
  ensure_infra

  echo -e "${GREEN}=== 重启服务: $services ===${NC}"

  # 先停止
  echo -e "${YELLOW}--- 停止旧服务 ---${NC}"
  docker-compose stop $services

  # 将 .env 中的 HOST 替换为容器名，以便 Docker 内部互访
  patch_env_for_docker

  # 确保网络和外部容器就绪
  docker network create $NETWORK_NAME 2>/dev/null || true
  ensure_network

  # 重新构建并启动
  echo -e "${YELLOW}--- 重新构建并启动 ---${NC}"
  docker-compose up -d --build $services

  echo -e "${GREEN}=== 重启完成 ===${NC}"
  docker-compose ps
}

do_stop() {
  local services=$(resolve_services "$1")
  echo -e "${YELLOW}=== 停止服务: $services ===${NC}"
  docker-compose stop $services
  # 恢复 .env 中的原始 HOST 配置
  restore_env
  echo -e "${GREEN}=== 已停止 ===${NC}"
  docker-compose ps
}

do_status() {
  docker-compose ps
}

do_logs() {
  local services=$(resolve_services "$1")
  docker-compose logs -f --tail=100 $services
}

# 主入口
COMMAND="${1:-start}"
SERVICE="${2:-all}"

case "$COMMAND" in
  start)
    do_start "$SERVICE"
    ;;
  restart)
    do_restart "$SERVICE"
    ;;
  stop)
    do_stop "$SERVICE"
    ;;
  status)
    do_status
    ;;
  logs)
    do_logs "$SERVICE"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    echo -e "${RED}未知命令: $COMMAND${NC}"
    usage
    ;;
esac
