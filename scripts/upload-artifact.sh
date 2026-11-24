#!/usr/bin/env bash
# 可靠上传部署产物：rsync 断点续传优先，scp 多次重试兜底，落盘后 SHA256 校验。
#
# 用法：
#   R_HOST=x R_USER=y R_PORT=22 SSH_KEY_PATH=/tmp/deploy_key \
#     bash scripts/upload-artifact.sh <本地文件> <远端文件名> [远端目录=/tmp]
#
# 环境变量：
#   UPLOAD_RETRIES      重试次数，默认 3
#   UPLOAD_TIMEOUT_SEC  单次传输硬超时秒数，默认 420
set -euo pipefail

LOCAL_FILE="${1:?用法: upload-artifact.sh <本地文件> <远端文件名> [远端目录]}"
REMOTE_NAME="${2:?用法: upload-artifact.sh <本地文件> <远端文件名> [远端目录]}"
REMOTE_DIR="${3:-/tmp}"

: "${R_HOST:?R_HOST 未设置}"
: "${R_USER:?R_USER 未设置}"
SSH_KEY_PATH="${SSH_KEY_PATH:-/tmp/deploy_key}"
R_PORT="${R_PORT:-22}"
MAX_TRY="${UPLOAD_RETRIES:-3}"
TIMEOUT_SEC="${UPLOAD_TIMEOUT_SEC:-420}"

SSH_OPTS="-i $SSH_KEY_PATH -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=15 -o ServerAliveInterval=10 -o ServerAliveCountMax=5 -p $R_PORT"

ssh_cmd() { ssh $SSH_OPTS "$R_USER@$R_HOST" "$@"; }

[ -f "$LOCAL_FILE" ] || { echo "::error::本地产物不存在：$LOCAL_FILE" >&2; exit 1; }
[ -r "$SSH_KEY_PATH" ] || { echo "::error::SSH 私钥不可读：$SSH_KEY_PATH" >&2; exit 1; }

LOCAL_SHA="$(sha256sum "$LOCAL_FILE" | awk '{print $1}')"
echo "上传产物：$(du -h "$LOCAL_FILE" | cut -f1)  sha256=$LOCAL_SHA"

# 清理可能残留的旧文件；rsync 失败时保留的是同名分片，下次会自动续传。
ssh_cmd "rm -f '$REMOTE_DIR/$REMOTE_NAME'"

uploaded=0
if ssh_cmd "command -v rsync >/dev/null 2>&1"; then
  echo "远端支持 rsync：启用断点续传"
  for i in $(seq 1 "$MAX_TRY"); do
    echo "rsync 第 $i/$MAX_TRY 次上传 ..."
    if timeout "${TIMEOUT_SEC}s" rsync -a --partial --append-verify \
        --timeout=60 --info=progress2 \
        -e "ssh $SSH_OPTS" \
        "$LOCAL_FILE" "$R_USER@$R_HOST:$REMOTE_DIR/$REMOTE_NAME"; then
      uploaded=1
      break
    fi
    echo "rsync 第 $i 次未成功，已保留远端分片，继续重试" >&2
  done
else
  echo "远端未安装 rsync：回退 scp 全量重传"
  for i in $(seq 1 "$MAX_TRY"); do
    echo "scp 第 $i/$MAX_TRY 次上传 ..."
    if timeout "${TIMEOUT_SEC}s" scp -i "$SSH_KEY_PATH" \
        -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=15 -o ServerAliveInterval=10 -o ServerAliveCountMax=5 \
        -P "$R_PORT" "$LOCAL_FILE" "$R_USER@$R_HOST:$REMOTE_DIR/$REMOTE_NAME"; then
      uploaded=1
      break
    fi
    echo "scp 第 $i 次未成功，重试" >&2
  done
fi

if [ "$uploaded" -ne 1 ]; then
  echo "::error::上传失败（已重试 $MAX_TRY 次），请检查链路或增大 UPLOAD_TIMEOUT_SEC" >&2
  exit 1
fi

REMOTE_SHA="$(ssh_cmd "sha256sum '$REMOTE_DIR/$REMOTE_NAME' | awk '{print \$1}'" | tr -d '\r\n')"
if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
  echo "::error::上传校验和不匹配 local=$LOCAL_SHA remote=$REMOTE_SHA" >&2
  exit 1
fi
echo "上传并校验通过：$R_USER@$R_HOST:$REMOTE_DIR/$REMOTE_NAME"
