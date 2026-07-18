#!/bin/sh
set -eu

if [ -n "${ORACLE_WALLET_ZIP_BASE64:-}" ]; then
  mkdir -p /app/wallet
  printf "%s" "$ORACLE_WALLET_ZIP_BASE64" | base64 -d > /tmp/oracle-wallet.zip
  unzip -o /tmp/oracle-wallet.zip -d /app/wallet >/dev/null
  export TNS_ADMIN="${TNS_ADMIN:-/app/wallet}"
fi

if [ -n "${TNS_ADMIN:-}" ]; then
  export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} -Doracle.net.tns_admin=${TNS_ADMIN}"
fi

exec java -jar /app/app.jar
