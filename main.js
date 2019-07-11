/* eslint-disable no-use-before-define */
/* eslint-disable no-console */
/* eslint-disable no-plusplus */
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
      const search = searchList.data.Page.media[0];
      await db.all('SELECT * FROM watching WHERE malID = (?)', [search.idMal], (err, row) => {
        if (err || row.length === 0) {
          db.run('INSERT INTO watching (userID, malID, aniID, nextEP, title, notified) values (?,?,?,?,?,?)', [message.member.id, search.idMal, search.id, search.nextAiringEpisode.airingAt, search.title.romaji, 0]);
          const d = new Date(search.nextAiringEpisode.airingAt * 1000);
          console.log('notify');
          console.log(message.member.id + search.title);
          message.channel.createMessage(`You will now be notified for ${search.title.romaji}. Next ep at ${d}\nMAL: ${malLink}${search.idMal}\nanilist: ${aniLink}${search.id}`);
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
      console.log('unnotify');
      console.log(message.member.id + search.title);
      client.createMessage(message.channel.id, `You will no longer get notifications for ${searchList.data.Page.media[0].title.romaji} mal: ${search.idMal}`);
    }
  }
});

function bigBrother() {
  console.log('Im always watching');
  setInterval(async () => {
    await db.all('select * FROM watching', (err, row) => {
      row.forEach(async (e) => {
        const time = Math.round((new Date()).getTime() / 1000);
        if (time >= e.nextEP && e.notified === 0) {
          // console.log(e)
          await notificationSender(e);
          db.run('UPDATE watching SET notified = (?) WHERE malID = (?) AND userID = (?)', [1, e.malID, e.userID]);
          console.log(`setting notified for ${e.userID} on ${e.title}(${e.malID})`);
        }
      });
    });
  }, watchingTimeout);
}
checkUpdate();
async function checkUpdate() {
  console.log('checking for updated times');
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
              console.log(`Updating ${e.malID} airtime`);
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
  console.log(`sending notification for ${row.title}(${row.malID}) to ${row.userID}`);
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

  console.log('calling API');
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

client.registerCommand('search', async (message, args) => {
  const search = [];

  let vars = {
    page: 1,
  };

  let typeLoc = -1;
  if (args.indexOf('-t') !== -1) {
    typeLoc = args.indexOf('-t') + 1;
    vars = Object.assign({ type: args[typeLoc].toUpperCase() }, vars);
  }

  let pn = 3;
  let pnLoc = -1;
  if (args.indexOf('-n') !== -1) {
    pnLoc = args.indexOf('-n') + 1;
    if (args[pnLoc] < 10) {
      pn = Number(args[pnLoc]);
    }
    if (args[pnLoc] > 10) {
      pn = 3;
    }
  }
  vars = Object.assign({ perPage: pn }, vars);

  args.forEach((i, index) => {
    if (index > typeLoc && index > pnLoc) {
      search.push(i);
    }
  });
  const txtSearch = search.join(' ');
  vars = Object.assign({ search: txtSearch }, vars);

  // console.log(vars);
  const searchList = await apiCall(vars);
  const search2 = searchList.data.Page.media;
  const msg = [];
  for (let i = 0; i < search2.length; i++) {
    let eTitle;
    if (search2[i].title.english == null) {
      eTitle = search2[i].title.romaji;
    }
    if (search2[i].title.english != null) {
      eTitle = search2[i].title.english;
    }
    msg.push(`title: ${search2[i].title.romaji} (${eTitle})\ntype: ${search2[i].type}\nlink: https://myanimelist.net/${search2[i].type.toLowerCase()}/${search2[i].idMal} `);
  }
  const res = msg.join('\n\n');
  // console.log(res);
  message.channel.createMessage(res);
});
