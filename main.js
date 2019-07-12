/* eslint-disable no-use-before-define */
/* eslint-disable no-console */
/* eslint-disable no-plusplus */
const Eris = require('eris');
const fetch = require('node-fetch');
const sqlite3 = require('sqlite3');
// const schedule = require('node-schedule');
const login = require('./config/login.json');

const prefix = '!';
const db = new sqlite3.Database('database.db');
const apiURL = 'https://graphql.anilist.co';
const client = new Eris.CommandClient(login.discord, {}, {
  defaultHelpCommand: false,
  description: 'A notifier bot',
  owner: 'OneDex',
  prefix,
});
client.connect();
const malLink = 'https://myanimelist.net/anime/';
const aniLink = 'https://anilist.co/anime/';
const watchingTimeout = 3600000;// 3600000
const updateTimeout = 28800000;
const embedColor = 16609747;
bigBrother();
checkUpdate();
client.registerCommand('notifyme', async (message, args) => {
  let c;
  const userSearch = [];
  let vars = {
    status: 'RELEASING',
    type: 'ANIME',
    page: 1,
    perPage: 1,
  };
  let idLoc = -1;
  if (args.indexOf('-ani') !== -1) {
    idLoc = args.indexOf('-ani') + 1;
    vars = Object.assign({ id: args[idLoc] }, vars);
    c = true;
  }
  let idMalLoc = -1;
  if (args.indexOf('-mal') !== -1) {
    idMalLoc = args.indexOf('-mal') + 1;
    vars = Object.assign({ idMal: args[idMalLoc] }, vars);
    c = true;
  }
  args.forEach((i, index) => {
    if (index > idLoc && index > idMalLoc) {
      userSearch.push(i);
    }
  });
  let txtSearch;
  if (userSearch.length > 0) {
    txtSearch = userSearch.join(' ');
    vars = Object.assign({ search: txtSearch }, vars);
  }
  // console.log(vars);
  const searchList = await apiCall(vars);
  // console.log(searchList);
  if (searchList.errors || !searchList.data.Page.media[0].title) return;
  if (searchList.data.Page.media[0]) {
    // console.log(searchList.data.Page.media[0].title);
    if (txtSearch) {
      Object.keys(searchList.data.Page.media[0].title).forEach((k) => {
        if (searchList.data.Page.media[0].title[k].toLowerCase() === txtSearch.toLowerCase() && c !== true) {
          c = true;
        }
      });
    }
  }
  if (c === true || idLoc !== -1 || idMalLoc !== -1) {
    // console.log('c === true');
    const search = searchList.data.Page.media[0];
    await db.all('SELECT * FROM watching WHERE malID = (?) AND userID = (?)', [search.idMal, message.member.id], (err, row) => {
      if (err || row.length === 0) {
        db.run('INSERT INTO watching (userID, malID, aniID, nextEP, title, notified) values (?,?,?,?,?,?)', [message.member.id, search.idMal, search.id, search.nextAiringEpisode.airingAt, search.title.romaji, 0]);
        const d = new Date(search.nextAiringEpisode.airingAt * 1000);
        console.log('notify');
        console.log(message.member.id + search.title);
        message.channel.createMessage(`You will now be notified for ${search.title.romaji}. Next ep at ${d}\nMAL: ${malLink}${search.idMal}\nanilist: ${aniLink}${search.id}`);
      }
    });
  }
}, {
  caseInsensitive: true,
});

client.registerCommand('unnotifyme', async (message, args) => {
  let c;
  const userSearch = [];
  let vars = {
    status: 'RELEASING',
    type: 'ANIME',
    page: 1,
    perPage: 1,
  };
  let idLoc = -1;
  if (args.indexOf('-ani') !== -1) {
    idLoc = args.indexOf('-ani') + 1;
    vars = Object.assign({ id: args[idLoc] }, vars);
    c = true;
  }
  let idMalLoc = -1;
  if (args.indexOf('-mal') !== -1) {
    idMalLoc = args.indexOf('-mal') + 1;
    vars = Object.assign({ idMal: args[idMalLoc] }, vars);
    c = true;
  }
  args.forEach((i, index) => {
    if (index > idLoc && index > idMalLoc) {
      userSearch.push(i);
    }
  });
  let txtSearch;
  if (userSearch.length > 0) {
    txtSearch = userSearch.join(' ');
    vars = Object.assign({ search: txtSearch }, vars);
  }
  const searchList = await apiCall(vars);
  if (searchList.errors || !searchList.data.Page.media[0].title) return;
  if (searchList.data.Page.media[0]) {
    // console.log(searchList.data.Page.media[0].title);
    if (txtSearch) {
      Object.keys(searchList.data.Page.media[0].title).forEach((k) => {
        if (searchList.data.Page.media[0].title[k].toLowerCase() === txtSearch.toLowerCase() && c !== true) {
          c = true;
        }
      });
    }
  }
  if (c === true) {
    const search = searchList.data.Page.media[0];
    db.run('DELETE FROM watching WHERE malID = (?) AND userID = (?)', [search.idMal, message.member.id]);
    console.log('unnotify');
    console.log(message.member.id + search.title);
    client.createMessage(message.channel.id, `You will no longer get notifications for ${searchList.data.Page.media[0].title.romaji}\nmal: ${malLink + search.idMal}\nanilist: ${aniLink + search.id}`);
  }
}, {
  caseInsensitive: true,
});
function bigBrother() {
  console.log(`Im always watching ${new Date()}`);
  setInterval(async () => {
    await db.all('select * FROM watching', (err, row) => {
      const notIDs = [];
      const time = Math.round((new Date()).getTime() / 1000);
      row.forEach((e) => {
        if (time >= e.nextEP && !notIDs.includes(e.malID) && e.notified === 0) {
          notIDs.push(e.malID);
        }
      });
      notIDs.forEach(async (ID) => {
        db.all('SELECT * FROM watching WHERE malID = (?)', [ID], (err2, row2) => {
          const uIDs = [];
          let nData = {};
          row2.forEach((e) => {
            uIDs.push(e.userID);
            nData = {
              malID: ID,
              aniID: e.aniID,
              title: e.title,
              nextEP: e.nextEP,
            };
          });
          nData.userID = uIDs;
          console.log(`notification: ${nData}`);
          notificationCreator(nData);
        });
      });
    });
  }, watchingTimeout);
}

async function checkUpdate() {
  setInterval(() => {
    console.log('checking for updated times');
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

async function notificationSender(uID, res) {
  // console.log(row)
  // console.log(row.userID)
  const chat = await client.getDMChannel(uID);

  console.log(`sending notification for: ${chat.id}`);
  client.createMessage(chat.id, {
    embed: {
      color: embedColor,
      thumbnail: {
        url: res.imageURL,
        height: 333,
        width: 2000,
      },
      description: res.sub,
      fields: res.final,
      footer: {
        text: login.user,
      },
      timestamp: new Date(),
    },
  });
}
async function notificationCreator(IDs) {
  const vars = {
    idMal: IDs.malID,
    type: 'ANIME',
    page: 1,
    perPage: 1,
  };
  const searchList = await apiCall(vars);
  const search = searchList.data.Page.media[0];
  const imageURL = search.coverImage.large;
  const airingEP = search.nextAiringEpisode.episode;
  // let totalEP = '?';
  // if (search.episodes) {
  //   totalEP = search.episodes;
  // }
  const sub = IDs.title;
  const final = [{
    name: `Episode #${airingEP} is now airing!`,
    value: `[MAL](${malLink + IDs.malID})\n [Anilist](${aniLink + IDs.aniID})`,
  }];
  const res = {
    sub,
    final,
    imageURL,
  };
  IDs.userID.forEach((uID) => {
    notificationSender(uID, res);
    db.run('UPDATE watching SET notified = (?) WHERE malID = (?) AND userID = (?)', [1, IDs.malID, uID]);
  });
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
  if (searchList.message) console.log(searchList.message);
  return searchList;
}


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
  if (searchList.errors || !searchList.data.Page.media[0].title) return;
  const search2 = await searchList.data.Page.media;
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
  // console.log(search2);
  const res = msg.join('\n\n');
  // console.log(res);
  message.channel.createMessage(res);
}, {
  caseInsensitive: true,
});
client.registerCommand('help', (message) => {
  message.channel.createMessage(`Commands:
  ${prefix}help: Shows this message
  ${prefix}notifyme: Will set you to be notified of anime. usage: !notifyme One Piece, !notifyme -mal 21, !notifyme -ani 21
  ${prefix}unnotifyme: Will stop notifications for said anime. usage: !unnotifyme One Piece, !unnotifyme -mal 21, !unnotifyme -ani 21
  ${prefix}search: Will get search results for said anime. usage: !search One Piece, !search -n 1 One Piece, !search -t MANGA One Piece`);
}, {
  caseInsensitive: true,
});
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
      coverImage {
        large
        medium
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
