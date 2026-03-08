#!/bin/bash
set -e

NETWORK_NAME="news_agent_default"
MYSQL_CONTAINER="mysql-container"
REDIS_CONTAINER="redis-container"

echo "=== 1. 确保外部容器已启动 ==="
docker start $MYSQL_CONTAINER 2>/dev/null || echo "  MySQL 容器未创建，请先创建"
docker start $REDIS_CONTAINER 2>/dev/null || echo "  Redis 容器未创建，请先创建"

echo "=== 2. 启动 docker-compose 服务 ==="
docker-compose up -d --build

echo "=== 3. 将外部容器加入网络 ==="
# 检查网络是否存在
if docker network inspect $NETWORK_NAME >/dev/null 2>&1; then
  # MySQL
  if docker network inspect $NETWORK_NAME | grep -q "$MYSQL_CONTAINER"; then
    echo "  MySQL 已在网络中，跳过"
  else
    docker network connect $NETWORK_NAME $MYSQL_CONTAINER
    echo "  MySQL 已加入网络"
  fi

  # Redis
  if docker network inspect $NETWORK_NAME | grep -q "$REDIS_CONTAINER"; then
    echo "  Redis 已在网络中，跳过"
  else
    docker network connect $NETWORK_NAME $REDIS_CONTAINER
    echo "  Redis 已加入网络"
  fi
else
  echo "  网络 $NETWORK_NAME 不存在，请检查 docker-compose 是否启动成功"
  exit 1
fi

echo "=== 4. 重启 api 确保连接生效 ==="
docker-compose restart api

echo "=== 启动完成 ==="
docker-compose ps
