/* eslint-disable max-len */
/* eslint-disable no-use-before-define */
/* eslint-disable no-console */
/* eslint-disable no-plusplus */
const Eris = require('eris');
const login = require('./config/login.json');
const db = require('./src/databaseHandler');
const api = require('./src/apiHandler');


const malLink = 'https://myanimelist.net/anime/';
const aniLink = 'https://anilist.co/anime/';
const watchingTimeout = 3600000;// 3600000
const updateTimeout = 28800000;// 28800000
const embedColor = 16609747;// 16609747
const prefix = '!';// !
const apiURL = 'https://graphql.anilist.co';
const client = new Eris.CommandClient(login.discord, {}, {
  defaultHelpCommand: false,
  description: 'A notifier bot',
  owner: 'OneDex',
  prefix,
});
client.connect();
bigBrother();
checkUpdate();

client.registerCommand('notifyme', async (message, args) => {
  if (!args.length) return;
  let c;
  let vars = {
    status: 'RELEASING',
    type: 'ANIME',
    page: 1,
    perPage: 1,
  };
  vars = await argParse(args, vars);
  const searchList = await api.call(vars);
  console.log(searchList.data.Page.media[0]);
  if (searchList.errors || !searchList.data.Page.media[0] || !searchList.data.Page.media[0].title) return;
  if (searchList.data.Page.media[0]) {
    console.log(searchList.data.Page.media[0].title);
    if (searchList.data.Page.media[0].id === Number(vars.id) || searchList.data.Page.media[0].idMal === Number(vars.idMal)) {
      c = true;
    }
    if (c !== true) {
      console.log('here\'s johnny');
      await Object.values(searchList.data.Page.media[0].title).forEach((k) => {
        if(!k) return;  
        if (k.toLowerCase() === vars.search.toLowerCase()) {
          c = true;
        }
      });
    }
  }
  console.log(c)
  if (c === true) {
    const search = searchList.data.Page.media[0];
    const row = await db.SelectWatching(search.idMal, message.member.id)
    if (err || row.length === 0) {
      await db.InsertWatching(message.member.id,
        search.idMal,
        search.id,
        search.nextAiringEpisode.airingAt,
        search.title.romaji,
        0);
      // const d = new Date(search.nextAiringEpisode.airingAt * 1000);
      console.log('notify');
      console.log(message.member.id + search.title);
      const imageURL = search.coverImage.large;
      const sub = search.title.romaji;
      const final = [{
        name: `You will now be notified when ${search.title.romaji} goes live!`,
        value: `[MAL](${malLink + search.idMal})\n [Anilist](${aniLink + search.id})`,
      }];
      const res = {
        sub,
        final,
        imageURL,
      };
      messageSender(1, message.channel.id, res);
    }

  }
}, { caseInsensitive: true });
client.registerCommandAlias('notify', 'notifyme');
client.registerCommandAlias('n', 'notifyme');

client.registerCommand('unnotifyme', async (message, args) => {
  if (!args.length) return;
  let c;
  let vars = {
    status: 'RELEASING',
    type: 'ANIME',
    page: 1,
    perPage: 1,
  };
  vars = await argParse(args, vars);
  if (vars.search === 'all') {
      const row = await db.SelectWatching(null, message.member.id);
      if (err || row.length === 0) return;
      await db.DeleteWatching(message.member.id)
      const res = `cleared notifications for ${message.member.username}`;
      messageSender(0, message.channel.id, res);
    return;
  }
  const searchList = await api.call(vars);
  if (searchList.errors || !searchList.data.Page.media[0] || !searchList.data.Page.media[0].title) return;
  if (searchList.data.Page.media[0]) {
    console.log(searchList.data.Page.media[0]);
    if (searchList.data.Page.media[0].id === Number(vars.id) || searchList.data.Page.media[0].idMal === Number(vars.idMal)) {
      c = true;
    }
    if (c !== true) {
      Object.values(searchList.data.Page.media[0].title).forEach((k) => {
        if (!k) return;
        if (k.toLowerCase() === vars.search.toLowerCase()) {
          c = true;
        }
      });
    }
  }
  if (c === true) {
    const search = searchList.data.Page.media[0];
    db.DeleteWatching(search.idMal, message.member.id);
    console.log('unnotify');
    console.log(message.member.id + search.title);
    const imageURL = search.coverImage.large;
    const sub = search.title.romaji;
    const final = [{
      name: `stopping notifications for ${search.title.romaji}`,
      value: `[MAL](${malLink + search.idMal})\n [Anilist](${aniLink + search.id})`,
    }];
    const res = {
      sub,
      final,
      imageURL,
    };
    messageSender(1, message.channel.id, res);
  }
}, { caseInsensitive: true });
client.registerCommandAlias('u', 'unnotifyme');
client.registerCommandAlias('unnotify', 'unnotifyme');

function bigBrother() {
  console.log(`Im always watching ${new Date()}`);
  setInterval(async () => {
      const row = db.SelectWatching();
      const notIDs = [];
      const time = Math.round((new Date()).getTime() / 1000);
      row.forEach((e) => {
        if (time >= e.nextEP && !notIDs.includes(e.malID) && e.notified === 0) {
          notIDs.push(e.malID);
        }
      });
      notIDs.forEach(async (ID) => {
      const row2 = await db.SelectWatching(ID);
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
  }, watchingTimeout);
}

function argParse(args, v) {
  const argList = ['-t', '-mal', '-ani', '-n'];
  const vars = v;
  const types = ['anime', 'manga'];
  const index = {
    type: -1,
    mal: -1,
    ani: -1,
    n: -1,
  };
  vars.perPage = 1;
  argList.forEach((a) => {
    if (a === '-t') {
      if (args.includes(a)) {
        const t = args.indexOf(a);
        if (args[t + 1].toLowerCase() !== 'anime' && args[t + 1].toLowerCase() !== 'manga') {
          index.type = t;
          return;
        }
        index.type = t + 1;
        const type = args[args.indexOf('-t') + 1].toLowerCase();
        if (types.includes(type)) {
          if (vars.type === undefined) {
            vars.type = type.toUpperCase();
          }
        }
      }
      if (a === '-mal') {
        if (args.includes(a)) {
          const m = args.indexOf(a);
          if (typeof args[m + 1] !== 'number') {
            index.mal = m;
            return;
          }
          index.mal = args.indexOf(a) + 1;
          if (vars.idMal === undefined) {
            vars.idMal = args[index.mal];
          }
        }
      }
      if (a === '-ani') {
        if (args.includes(a)) {
          const n = args.indexOf(a);
          if (typeof args[n + 1] !== 'number') {
            index.ani = n;
            return;
          }
          index.ani = args.indexOf(a) + 1;
          if (vars.id === undefined && vars.idMal === undefined) {
            vars.id = args[index.ani];
          }
        }
      }
      if (a === '-n') {
        if (args.includes(a)) {
          const n = args.indexOf(a);
          if (typeof (args[n + 1]) !== 'number') {
            index.n = n;
            return;
          }
          index.n = args.indexOf(a) + 1;
          if (args[index.n] < 5) {
            if (index.mal === -1 && index.ani === -1) {
              vars.perPage = args[index.n];
            }
          }
        }
      }
    }
  });

  const search = [];
  const values = Object.values(index);
  args.forEach((a, i) => {
    if (values.every(t => t < i)) {
      search.push(a);
    }
  });
  if (search && search.length) {
    vars.search = search.join(' ');
  }
  return vars;
}

async function checkUpdate() {
  setInterval(() => {
    console.log('checking for updated times');
    const row = db.SelectWatching(null, null, notified)
      if (row.length !== 0) {
        row.forEach((e, index) => {
          setTimeout(async () => {
            const vars = {
              idMal: e.malID,
              type: 'ANIME',
              page: 1,
              perPage: 1,
            };
            const searchList = await api.call(vars);
            const res = searchList.data.Page.media[0];
            if (!res.nextAiringEpisode) {
              await db.DeleteWatching(e.malID, null);
              return;
            }
            if (e.nextEP !== res.nextAiringEpisode.airingAt && e.nextEP < res.nextAiringEpisode.airingAt) {
              console.log(`Updating ${e.malID} airtime`);
              db.UpdateWatching(0, res.nextAiringEpisode.airingAt, e.malID);
            }
          }, 2500 * index);
        });
      }
  }, updateTimeout);
}

function messageSender(rich, id, res) {
  if (rich === 1) {
    let embed = {};
    if (res.imageURL !== undefined) {
      embed = {
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
      };
    }
    if (res.imageURL === undefined) {
      embed = {
        color: embedColor,
        description: res.sub,
        fields: res.final,
        footer: {
          text: login.user,
        },
        timestamp: new Date(),
      };
    }
    client.createMessage(id, {
      embed,
    });
    return;
  }
  client.createMessage(id, res);
}

async function notificationCreator(IDs) {
  const vars = {
    idMal: IDs.malID,
    type: 'ANIME',
    page: 1,
    perPage: 1,
  };
  const searchList = await api.call(vars);
  const search = searchList.data.Page.media[0];
  const imageURL = search.coverImage.large;
  const airingEP = search.nextAiringEpisode.episode;
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
  IDs.userID.forEach(async (uID) => {
    const chat = await client.getDMChannel(uID);
    messageSender(1, chat.id, res);
    db.UpdateWatching(1, null, IDs.malID, uID);
  });
}

client.registerCommand('search', async (message, args) => {
  let vars = {
    page: 1,
  };
  vars = await argParse(args, vars);
  const searchList = await api.call(vars);
  if (searchList.errors || !searchList.data.Page.media[0].title) return;
  const search2 = await searchList.data.Page.media;
  const final = [];
  search2.forEach((show) => {
    const tempObj = {};
    if (show.title.english) {
      tempObj.name = `${show.title.romaji} (${show.title.english})`;
    }
    if (!show.title.english) {
      tempObj.name = `${show.title.romaji}`;
    }
    tempObj.value = `${show.type}\n[mal](${malLink + show.idMal})\n[anilist](${aniLink + show.id})`;
    final.push(tempObj);
  });
  const res = {
    sub: 'search',
    final,
  };
  messageSender(1, message.channel.id, res);
}, { caseInsensitive: true });
client.registerCommandAlias('s', 'search');

client.registerCommand('help', (message) => {
  const final = [{
    name: `${prefix}help, ${prefix}h`,
    value: 'Brings up command list',
  }, {
    name: `${prefix}notifyme, ${prefix}notify,${prefix}n`,
    value: `usage: ${prefix}n One Piece, ${prefix}n -mal 21, ${prefix}n -ani 21
    Get notified when an episode comes out`,
  }, {
    name: `${prefix}unnotifyme, ${prefix}unnotify, ${prefix}u`,
    value: `usage: ${prefix}u One Piece, ${prefix}u -mal 21, ${prefix}u -ani 21, ${prefix}u all
    Stops notifications for anime episodes.`,
  }, {
    name: `${prefix}search, ${prefix}s`,
    value: `usage: ${prefix}s One Piece, ${prefix}s -t MANGA One Piece, ${prefix}s -t ANIME -n 2 One Piece, ${prefix}s -mal 21`,
  }];
  const res = {
    sub: 'Commands:',
    final,
  };
  messageSender(1, message.channel.id, res);
}, { caseInsensitive: true });
client.registerCommandAlias('h', 'help');

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
