import { gradeDue } from '../ledger/grade.js';
const n = await gradeDue();
console.log(`Graded ${n} due prediction(s).`);
