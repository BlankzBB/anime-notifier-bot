const Eris = require('eris');
const fetch = require('node-fetch');
const login = require('./config/login.json')

const client = new Eris.CommandClient(login.discord, {}, {
    defaultHelpCommand: false,
    description: 'A notifier bot',
    owner: 'OneDex',
    prefix: '!',
  });

  client.connect();

client.registerCommand('search', (message, args) => {
    const aniSearch = args.join(' ');
    
    let query = `query ($id: Int, $page: Int, $perPage: Int, $search: String, $type: MediaType) {
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
      }`

    let vars = {
        search: aniSearch,
        type: 'ANIME',
        page: 1,
        perPage: 3,
    }

    let url = 'https://graphql.anilist.co',
    options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            query: query,
            variables: vars
        })
    };

    fetch(url, options).then((res) => res.json())
                   .then((res) => {
                     console.log(res.data.Page.media[1])
                     message.channel.createMessage(`title: ${res.data.Page.media[1].title.romaji} (${res.data.Page.media[1].title.english})\nlink: https://myanimelist.net/anime/${res.data.Page.media[1].id}`)
                   })
})