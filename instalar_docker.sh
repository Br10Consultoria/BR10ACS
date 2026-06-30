#!/bin/bash

set -e

echo "======================================"
echo " INSTALADOR AUTOMÁTICO DO DOCKER"
echo " Debian 13"
echo "======================================"
echo

# Verifica se é root
if [ "$EUID" -ne 0 ]; then
    echo "Execute este script como root."
    exit 1
fi

# Verifica se o Docker já está instalado
if command -v docker >/dev/null 2>&1; then
    echo "Docker já está instalado."
    docker --version
    docker compose version || true
    exit 0
fi

echo
echo "[1/8] Atualizando pacotes..."
apt update

echo
echo "[2/8] Instalando dependências..."
apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

echo
echo "[3/8] Criando diretório da chave..."
install -m 0755 -d /etc/apt/keyrings

echo
echo "[4/8] Baixando chave GPG do Docker..."
curl -fsSL https://download.docker.com/linux/debian/gpg \
| gpg --dearmor -o /etc/apt/keyrings/docker.gpg

chmod a+r /etc/apt/keyrings/docker.gpg

echo
echo "[5/8] Adicionando repositório oficial..."

ARCH=$(dpkg --print-architecture)
CODENAME=$(source /etc/os-release && echo "$VERSION_CODENAME")

echo \
"deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/debian \
$CODENAME stable" \
> /etc/apt/sources.list.d/docker.list

echo
echo "[6/8] Atualizando lista de pacotes..."
apt update

echo
echo "[7/8] Instalando Docker..."
apt install -y \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin

echo
echo "[8/8] Habilitando serviço..."
systemctl enable docker
systemctl restart docker

echo
echo "======================================"
echo "Instalação concluída!"
echo "======================================"

echo
docker --version
docker compose version

echo
echo "Testando funcionamento..."
docker run --rm hello-world

echo
echo "Docker instalado com sucesso!"
