const sqlite3 = require('sqlite3');

const { promisify } = require('util');
const db = new sqlite3.Database('database.db');

const dbAll = promisify(db.all).bind(db);
const dbRun = promisify(db.run).bind(db);

const databaseHandler = module.exports;

databaseHandler.SelectWatching = async (malID, userID, notified) => {
  if (!malID, !userID, !notified) return await dbAll('select * FROM watching');
  if (malID) return await dbAll('SELECT * FROM watching WHERE malID = (?) AND userID = (?)', [malID, userID ]);
  if (notified) return await dbRun('SELECT * FROM watching WHERE notified = (?)', [notified]);
  return await dbAll('SELECT * FROM watching WHERE userID = (?)', [userID]);
}

databaseHandler.InsertWatching = async (userID, malID, aniID, nextEP, title) =>
  await dbRun('INSERT INTO watching (userID, malID, aniID, nextEP, title, notified) values (?,?,?,?,?,?)',
  [userID, malID, aniID, nextEP, title, 0]);

databaseHandler.DeleteWatching = async (malID, userID) => {
  if (!malID) return await dbRun('DELETE FROM watching WHERE userID = (?)', [userID]);
  if (!userID) return await dbRun('DELETE FROM watching WHERE malID = (?)', [malID]);
  return await dbRun('DELETE FROM watching WHERE malID = (?) AND userID = (?)', [malID, userID]);
}

databaseHandler.UpdateWatching = async (notified, nextEP, malID, userID) => {
  if(userID) return await dbRun('UPDATE watching SET notified = (?) WHERE malID = (?) AND userID = (?)', [1, IDs.malID, uID]);
  return await dbRun('UPDATE watching SET notified = (?), nextEP = (?) WHERE malID = (?)', [notified, nextEP, e.malID])
}