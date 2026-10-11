// Prints an AUTH_PASSWORD_HASH value for Railway. Usage: npm run hash-password
// The password is typed here and never stored or sent anywhere.
import { createInterface } from 'node:readline';
import { hashPassword } from '../auth.js';

const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.question('Choose a password (min 10 characters): ', (pw) => {
  rl.close();
  if (pw.length < 10) {
    console.error('Too short — use at least 10 characters.');
    process.exit(1);
  }
  console.log('\nSet this in Railway → Variables as AUTH_PASSWORD_HASH:\n');
  console.log(hashPassword(pw));
  console.log('\n(Clear your terminal afterwards if others can see your screen.)');
});
