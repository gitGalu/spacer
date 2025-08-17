import Dexie from 'dexie';

const DATABASE_NAME = 'Spacer';
const DATABASE_VERSION = 1;

const db = new Dexie(DATABASE_NAME);

db.version(DATABASE_VERSION).stores({
  scenario: 'id'
});
export default db;