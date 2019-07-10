/* TODO
* Find a way to get next EP without making user redo command */
/* eslint-disable no-use-before-define */
/* eslint-disable no-console */
const Eris = require('eris');
const fetch = require('node-fetch');
const sqlite3 = require('sqlite3');
// const schedule = require('node-schedule');
const login = require('./config/login.json');

const db = new sqlite3.Database('database.db');
const apiURL = 'https://graphql.anilist.co';
const client = new Eris.CommandClient(login.discord, {}, {
  defaultHelpCommand: false,
  description: 'A notifier bot',
  owner: 'OneDex',
  prefix: '!',
});
client.connect();
const malLink = 'https://myanimelist.net/anime/';
const aniLink = 'https://anilist.co/anime/';
bigBrother();

client.registerCommand('notifyme', async (message, args) => {
  const userSearch = args.join(' ');
  const vars = {
    status: 'RELEASING',
    search: userSearch,
    type: 'ANIME',
    page: 1,
    perPage: 1,
  };
  const searchList = await apiCall(query, vars);
  db.all('SELECT * FROM watching WHERE malID = (?)', [searchList.idMal], (err, row) => {
    if (err || row.length === 0) {
      db.run('INSERT INTO watching (userID, malID, aniID, nextEP) values (?,?,?,?,?)', [message.member.id, searchList.idMal, searchList.id, searchList.nextAiringEpisode.airingAt, searchList.title.romaji], insErr => console.log(insErr));
    }
  });
});
async function bigBrother() {
  setInterval(async () => {
    const notifiedIDs = [];
    await db.all('select * FROM watching', (err, row) => {
      row.forEach((e) => {
        const time = Math.round((new Date()).getTime() / 1000);
        if (time >= e.nextEP) {
          notificationSender(e);
          notifiedIDs.push(e.malID);
        }
      });
    });
    notifiedIDs.forEach((i) => {
      db.run('DELETE * FROM watching WHERE malID = (?)', [i]);
    });
  }, 3600000);
}

function notificationSender(row) {
  const ID = client.getDMChannel(row.userID);
  client.createMessage(ID, `${row.title} is now airing. 
  Mal: ${malLink + row.malID}
  Anilist: ${aniLink + row.aniID}`);
}
async function apiCall(query, vars) {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: vars,
    }),
  };
  const searchList = await fetch(apiURL, options)
    .then(res => res.json())
    .then(res => res.data.Page.media);
  return searchList[0];
}

const query = `query ($id: Int, $page: Int, $perPage: Int, $search: String, $type: MediaType) {
  Page (page: $page, perPage: $perPage) {
    media (id: $id, search: $search, type: $type) {
      id
      idMal
      title {
        romaji,
        english,
        native
      }
      type
      status
      updatedAt
      startDate {
        year
        month
        day
      }
      endDate {
        year
        month
        day
      }
      episodes
      nextAiringEpisode {
        episode
        airingAt
        timeUntilAiring
      }
    }
  }
}`;
