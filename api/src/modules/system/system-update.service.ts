import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { Subject } from 'rxjs';
import * as path from 'path';
import * as fs from 'fs';

export interface UpdateLogLine {
  type: 'stdout' | 'stderr' | 'info' | 'success' | 'error' | 'warn' | 'done';
  message: string;
  ts: string;
}

@Injectable()
export class SystemUpdateService {
  private readonly logger = new Logger(SystemUpdateService.name);
  private updating = false;

  isUpdating(): boolean {
    return this.updating;
  }

  /**
   * Detecta o diretório do projeto no host.
   * O caminho do projeto no host é passado via env PROJECT_DIR.
   * Fallback: /opt/BR10ACS
   */
  private getProjectDir(): string {
    return process.env.PROJECT_DIR || '/opt/BR10ACS';
  }

  /**
   * Executa a atualização do sistema via git pull + docker compose rebuild.
   * Retorna um Subject que emite linhas de log em tempo real.
   */
  startUpdate(): Subject<UpdateLogLine> {
    const subject = new Subject<UpdateLogLine>();

    if (this.updating) {
      setTimeout(() => {
        subject.next({
          type: 'error',
          message: 'Já existe uma atualização em andamento.',
          ts: new Date().toISOString(),
        });
        subject.next({
          type: 'done',
          message: 'Atualização já em andamento.',
          ts: new Date().toISOString(),
        });
        subject.complete();
      }, 100);
      return subject;
    }

    this.updating = true;

    const emit = (type: UpdateLogLine['type'], message: string) => {
      subject.next({ type, message, ts: new Date().toISOString() });
    };

    const projectDir = this.getProjectDir();
    this.logger.log(`Iniciando atualização do sistema em: ${projectDir}`);

    emit('info', '══════════════════════════════════════════');
    emit('info', '   BR10 ACS — Atualização do Sistema');
    emit('info', '══════════════════════════════════════════');
    emit('info', `Diretório do projeto: ${projectDir}`);
    emit('info', 'Iniciando processo de atualização...');
    emit('info', '');

    this.runUpdateProcess(subject, emit, projectDir);

    return subject;
  }

  private runUpdateProcess(
    subject: Subject<UpdateLogLine>,
    emit: (type: UpdateLogLine['type'], message: string) => void,
    projectDir: string,
  ) {
    const script = this.buildUpdateScript(projectDir);

    const child = spawn('sh', ['-c', script], {
      env: {
        ...process.env,
        PROJECT_DIR: projectDir,
        HOME: '/root',
        PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      },
      cwd: projectDir,
    });

    child.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter((l) => l.trim());
      lines.forEach((line) => {
        if (line.startsWith('ERRO:') || line.startsWith('ERROR:')) {
          emit('error', line);
        } else if (line.startsWith('[') && line.includes('/')) {
          emit('info', line);
        } else {
          emit('stdout', line);
        }
      });
    });

    child.stderr.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter((l) => l.trim());
      lines.forEach((line) => emit('warn', line));
    });

    child.on('close', (code) => {
      this.updating = false;
      if (code === 0) {
        emit('info', '');
        emit('success', '══════════════════════════════════════════');
        emit('success', '   Atualização concluída com sucesso!');
        emit('success', '   O sistema será reiniciado em instantes.');
        emit('success', '══════════════════════════════════════════');
        emit('done', 'Atualização concluída com sucesso!');
      } else {
        emit('error', '');
        emit('error', `Atualização falhou com código de saída: ${code}`);
        emit('error', 'Verifique os logs acima para mais detalhes.');
        emit('done', `Atualização falhou (código ${code})`);
      }
      subject.complete();
    });

    child.on('error', (err) => {
      this.updating = false;
      emit('error', `Erro ao executar processo de atualização: ${err.message}`);
      emit('done', `Erro: ${err.message}`);
      subject.complete();
    });
  }

  private buildUpdateScript(projectDir: string): string {
    return `#!/bin/sh
set -e

PROJECT_DIR="${projectDir}"

echo "[1/4] Verificando diretório do projeto..."
if [ ! -d "$PROJECT_DIR/.git" ]; then
  echo "ERRO: Diretório $PROJECT_DIR não é um repositório git válido."
  exit 1
fi

cd "$PROJECT_DIR"

echo "[2/4] Baixando atualizações do GitHub..."
git fetch origin main 2>&1
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "Sistema já está na versão mais recente."
  echo "Commit atual: $(git log -1 --format='%h — %s')"
  echo "Nenhuma atualização disponível."
  exit 0
fi

echo "Nova versão disponível:"
git log --oneline HEAD..origin/main 2>&1
git pull origin main 2>&1

echo ""
echo "[3/4] Reconstruindo container da aplicação..."
docker compose up -d --build br10acs-api 2>&1

echo ""
echo "[4/4] Verificando status dos containers..."
docker compose ps 2>&1

echo ""
echo "Versão atual: $(git log -1 --format='%h — %s (%cr)')"
`;
  }

  /**
   * Retorna informações de versão do sistema (último commit git).
   */
  async getVersionInfo(): Promise<{
    currentVersion: string;
    lastCommitHash: string;
    lastCommitMessage: string;
    lastCommitDate: string;
    branch: string;
  }> {
    return new Promise((resolve) => {
      const projectDir = this.getProjectDir();

      const child = spawn(
        'git',
        ['log', '-1', '--format=%H|%s|%ci', '--', '.'],
        {
          cwd: projectDir,
          env: {
            ...process.env,
            HOME: '/root',
            PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
          },
        },
      );

      let output = '';
      child.stdout.on('data', (d: Buffer) => (output += d.toString()));

      child.on('close', () => {
        const parts = output.trim().split('|');
        const hash = parts[0]?.substring(0, 8) || 'unknown';
        const msg  = parts[1] || 'unknown';
        const date = parts[2] || 'unknown';

        // Tenta ler o branch atual
        const branchChild = spawn('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
          cwd: projectDir,
          env: { ...process.env, HOME: '/root', PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' },
        });
        let branch = 'main';
        branchChild.stdout.on('data', (d: Buffer) => (branch = d.toString().trim()));
        branchChild.on('close', () => {
          resolve({
            currentVersion: process.env.npm_package_version || '1.0.0',
            lastCommitHash: hash,
            lastCommitMessage: msg,
            lastCommitDate: date,
            branch,
          });
        });
        branchChild.on('error', () => {
          resolve({
            currentVersion: process.env.npm_package_version || '1.0.0',
            lastCommitHash: hash,
            lastCommitMessage: msg,
            lastCommitDate: date,
            branch: 'main',
          });
        });
      });

      child.on('error', () => {
        resolve({
          currentVersion: process.env.npm_package_version || '1.0.0',
          lastCommitHash: 'unknown',
          lastCommitMessage: 'unknown',
          lastCommitDate: 'unknown',
          branch: 'main',
        });
      });
    });
  }
}
