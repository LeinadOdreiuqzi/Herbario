import { hashPassword } from '../utils/passwords.js';

const password = process.argv[2];
if (!password) {
  console.error('Uso: node src/scripts/hash-password.js "<password>"');
  process.exit(1);
}
console.log(hashPassword(password));