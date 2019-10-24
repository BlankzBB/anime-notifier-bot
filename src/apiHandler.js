const fetch = require('node-fetch');

apiHandler = module.exports;

apiHandler.call = (vars) => {
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