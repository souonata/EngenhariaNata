#!/bin/sh
set -eu

IPTABLES=/usr/sbin/iptables
CHAIN=PINTOR-API
CONNECTOR_IP=${PINTOR_CONNECTOR_IP:-192.168.1.10}
PORT=${PINTOR_API_PORT:-8765}

$IPTABLES -N "$CHAIN" 2>/dev/null || true
$IPTABLES -F "$CHAIN"
$IPTABLES -C DOCKER-USER -j "$CHAIN" 2>/dev/null || \
    $IPTABLES -I DOCKER-USER 1 -j "$CHAIN"

$IPTABLES -A "$CHAIN" -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
$IPTABLES -A "$CHAIN" -s "$CONNECTOR_IP" -p tcp --dport "$PORT" -j RETURN
$IPTABLES -A "$CHAIN" -p tcp --dport "$PORT" -j DROP
$IPTABLES -A "$CHAIN" -i br-pintor -j DROP
$IPTABLES -A "$CHAIN" -j RETURN
