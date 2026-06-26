/**
 * Script de seed: cria o usuário admin inicial no banco br10
 * Uso: node -r tsconfig-paths/register dist/scripts/seed-admin.js
 * Ou em dev: pnpm ts-node src/scripts/seed-admin.ts
 */

import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as readline from 'readline';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/br10';

const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  name: String,
  email: String,
  role: String,
  status: String,
  createdAt: Date,
  updatedAt: Date,
});

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function seed() {
  console.log('\n🚀 BR10ACS — Criação do usuário admin inicial\n');
  console.log(`📦 Conectando ao MongoDB: ${MONGODB_URI}\n`);

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Conectado ao MongoDB\n');

  const User = mongoose.model('User', UserSchema, 'users');

  // Verificar se já existe um admin
  const existing = await User.findOne({ role: 'super_admin' });
  if (existing) {
    console.log(`⚠️  Já existe um super_admin: ${existing.username}`);
    console.log('   Para criar outro, use a API ou altere diretamente no banco.\n');
    await mongoose.disconnect();
    process.exit(0);
  }

  // Coletar dados
  const username = (await prompt('Username [admin]: ')) || 'admin';
  const name = (await prompt('Nome completo [Administrador BR10]: ')) || 'Administrador BR10';
  const email = (await prompt('E-mail [admin@br10.com.br]: ')) || 'admin@br10.com.br';

  let password = '';
  while (password.length < 8) {
    password = await prompt('Senha (mínimo 8 caracteres): ');
    if (password.length < 8) console.log('❌ Senha muito curta. Tente novamente.');
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const admin = await User.create({
    username,
    password: hashedPassword,
    name,
    email,
    role: 'super_admin',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`\n✅ Usuário admin criado com sucesso!`);
  console.log(`   ID:       ${admin._id}`);
  console.log(`   Username: ${username}`);
  console.log(`   Role:     super_admin`);
  console.log(`\n🔐 Guarde a senha em local seguro. Ela não pode ser recuperada.\n`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Erro ao criar admin:', err.message);
  process.exit(1);
});
