/* eslint-disable no-use-before-define */
/* eslint-disable no-console */
const Eris = require('eris');
const fetch = require('node-fetch');
const login = require('./config/login.json');

const apiURL = 'https://graphql.anilist.co';
const client = new Eris.CommandClient(login.discord, {}, {
  defaultHelpCommand: false,
  description: 'A notifier bot',
  owner: 'OneDex',
  prefix: '!',
});

client.connect();

client.registerCommand('search', (message, args) => {
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

  apiCall(query, vars, (searchList) => {
    // console.log(searchList);
    messageCreator(message, searchList);
  });
});

function apiCall(query, vars, callback) {
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
  fetch(apiURL, options)
    .then(res => res.json())
    .then((res) => {
      const searchList = res.data.Page.media;
      callback(searchList);
    });
}

function messageCreator(message, searchList) {
  const msg = [];
  for (i = 0; i < searchList.length; i++) {
    let eTitle;
    if (searchList[i].title.english == null) {
      eTitle = searchList[i].title.romaji;
    }
    if (searchList[i].title.english != null) {
      eTitle = searchList[i].title.english;
    }
    msg.push(`title: ${searchList[i].title.romaji} (${eTitle})\ntype: ${searchList[i].type}\nlink: https://myanimelist.net/${searchList[i].type.toLowerCase()}/${searchList[i].idMal} `);
  }
  const res = msg.join('\n\n');
  // console.log(res);
  message.channel.createMessage(`${res}`);
}

client.registerCommand('ping', (message) => {
  message.channel.createMessage('pong!')
})
client.registerCommandAlias('Ping', 'ping');