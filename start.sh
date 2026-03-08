#!/bin/bash
set -e

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

echo "=== 3. 启动 docker-compose 服务 ==="
# API 容器通过 extra_hosts(host.docker.internal) 直接访问宿主机上的 MySQL/Redis
docker-compose up -d --build

echo "=== 启动完成 ==="
docker-compose ps
