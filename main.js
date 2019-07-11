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
const watchingTimeout = 3600000;// 3600000
const updateTimeout = 3600000;
bigBrother();

client.registerCommand('notifyme', async (message, args) => {
  const userSearch = args.join(' ');
  console.log(userSearch);
  const vars = {
    status: 'RELEASING',
    search: userSearch,
    type: 'ANIME',
    page: 1,
    perPage: 1,
  };

  const searchList = await apiCall(vars);
  let c;
  if (searchList.data.Page.media) {
    console.log(searchList.data.Page.media[0].title);
    Object.keys(searchList.data.Page.media[0].title).forEach((k) => {
      if (searchList.data.Page.media[0].title[k].toLowerCase() === userSearch.toLowerCase()) {
        c = true;
      }
    });
    if (c === true) {
      console.log(c);
      const search = searchList.data.Page.media[0];
      await db.all('SELECT * FROM watching WHERE malID = (?)', [search.idMal], (err, row) => {
        if (err || row.length === 0) {
          db.run('INSERT INTO watching (userID, malID, aniID, nextEP, title, notified) values (?,?,?,?,?,?)', [message.member.id, search.idMal, search.id, search.nextAiringEpisode.airingAt, search.title.romaji, 0]);
        }
      });
    }
  }
});

client.registerCommand('unnotifyme', async (message, args) => {
  const userSearch = args.join(' ');
  const vars = {
    status: 'RELEASING',
    search: userSearch,
    type: 'ANIME',
    page: 1,
    perPage: 1,
  };
  const searchList = await apiCall(vars);
  let c;
  if (searchList.data.Page.media) {
    console.log(searchList.data.Page.media[0].title);
    Object.keys(searchList.data.Page.media[0].title).forEach((k) => {
      if (searchList.data.Page.media[0].title[k].toLowerCase() === userSearch.toLowerCase()) {
        c = true;
      }
    });
    if (c === true) {
      const search = searchList.data.Page.media[0];
      db.run('DELETE FROM watching WHERE malID = (?) AND userID = (?)', [search.idMal, message.member.id]);
    }
  }
});

function bigBrother() {
  setInterval(async () => {
    await db.all('select * FROM watching', (err, row) => {
      row.forEach(async (e) => {
        const time = Math.round((new Date()).getTime() / 1000);
        if (time >= e.nextEP && e.notified === 0) {
          // console.log(e)
          await notificationSender(e);
          db.run('UPDATE watching SET notified = (?) WHERE malID = (?) AND userID = (?)', [1, e.malID, e.userID]);
        }
      });
    });
  }, watchingTimeout);
}
checkUpdate();
async function checkUpdate() {
  setInterval(() => {
    db.all('SELECT * FROM watching WHERE notified = (?)', [1], (err, row) => {
      if (row.length !== 0) {
        row.forEach((e, index) => {
          setTimeout(async () => {
            const vars = {
              idMal: e.malID,
              type: 'ANIME',
              page: 1,
              perPage: 1,
            };
            const res = await apiCall(vars);
            if (e.nextEP !== res.nextAiringEpisode.airingAt && e.nextEP < res.nextAiringEpisode.airingAt) {
              db.run('UPDATE watching SET notified = (?), nextEP = (?) WHERE malID = (?)', [0, res.nextAiringEpisode.airingAt, e.malID]);
            }
          }, 2500 * index);
        });
      }
    });
  }, updateTimeout);
}

async function notificationSender(row) {
  // console.log(row)
  // console.log(row.userID)
  const chat = await client.getDMChannel(row.userID);
  client.createMessage(chat.id, `${row.title} is now airing. 
  Mal: ${malLink + row.malID}
  Anilist: ${aniLink + row.aniID}`);
}

async function apiCall(vars) {
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
    .then(res => res.json());
  return searchList;
}

const query = `query ($status: MediaStatus, $idMal: Int, $id: Int, $page: Int, $perPage: Int, $search: String, $type: MediaType) {
  Page (page: $page, perPage: $perPage) {
    media (status: $status, idMal: $idMal, id: $id, search: $search, type: $type) {
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
