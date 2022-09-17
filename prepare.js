import { createRequire } from "module";
const require = createRequire(import.meta.url);
const fs = require('node:fs')
const Database = require('better-sqlite3')
const database = new Database('tidalfix.db')
database.exec(fs.readFileSync('dump.sql', 'utf-8'))
database.close()
console.log('database ready')