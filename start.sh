#!/bin/bash
set -e

NETWORK_NAME="news_agent_net"
MYSQL_CONTAINER="mysql-container"
REDIS_CONTAINER="redis-container"

echo "=== 1. 确保外部容器已启动 ==="
docker start $MYSQL_CONTAINER 2>/dev/null || echo "  MySQL 容器未创建，请先创建"
docker start $REDIS_CONTAINER 2>/dev/null || echo "  Redis 容器未创建，请先创建"

echo "=== 2. 等待 MySQL 就绪 ==="
for i in $(seq 1 10); do
  if docker exec $MYSQL_CONTAINER mysqladmin ping -h 127.0.0.1 --silent 2>/dev/null; then
    echo "  MySQL 已就绪"
    break
  fi
  echo "  等待 MySQL 启动中... ($i/10)"
  sleep 2
done

echo "=== 3. 启动 docker-compose 服务（会自动创建网络 $NETWORK_NAME）==="
docker-compose up -d --build

echo "=== 4. 将外部容器加入共享网络 ==="
# MySQL
if docker network inspect $NETWORK_NAME 2>/dev/null | grep -q "$MYSQL_CONTAINER"; then
  echo "  MySQL 已在网络中，跳过"
else
  docker network connect $NETWORK_NAME $MYSQL_CONTAINER && echo "  MySQL 已加入网络" || echo "  MySQL 加入网络失败"
fi

# Redis
if docker network inspect $NETWORK_NAME 2>/dev/null | grep -q "$REDIS_CONTAINER"; then
  echo "  Redis 已在网络中，跳过"
else
  docker network connect $NETWORK_NAME $REDIS_CONTAINER && echo "  Redis 已加入网络" || echo "  Redis 加入网络失败"
fi

echo "=== 5. 重启 api 确保连接生效 ==="
docker-compose restart api

echo "=== 启动完成 ==="
docker-compose ps
