const path = require("path");
const express = require("express");
const url = require("url");
const compression = require("compression");
const favicon = require("serve-favicon");
const serveStatic = require("serve-static");
const { google } = require("googleapis");
const fetch = require("node-fetch");
const AbortController = require("abort-controller");
const bodyParser = require("body-parser");

const Server = ({ database, serviceAccountPath, token }) => {
  // Load the service account key JSON file.
  const serviceAccount = serviceAccountPath
    ? require(serviceAccountPath)
    : null;

  // Define the required scopes.
  const scopes = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/firebase.database"
  ];

  // Authenticate a JWT client with the service account.
  const jwtClient =
    serviceAccount &&
    new google.auth.JWT(
      serviceAccount.client_email,
      null,
      serviceAccount.private_key,
      scopes
    );

  let cachedToken = null;
  const getToken = () => {
    if (!serviceAccount) {
      // if service account not specified, use given token.
      return Promise.resolve(token);
    }
    if (cachedToken && cachedToken.expiry_date > Date.now()) {
      return Promise.resolve(cachedToken.access_token);
    }
    return new Promise((resolve, reject) => {
      jwtClient.authorize((error, token) => {
        if (error) {
          reject(`Error making request to generate access token: ${error}`);
        } else if (token.access_token === null) {
          reject(
            "Provided service account does not have permission to generate access tokens"
          );
        } else {
          cachedToken = token;
          resolve(cachedToken.access_token);
        }
      });
    });
  };

  const app = express();
  const port = 8080;
  const serveDir = path.join(__dirname, "build");
  const fallbackPage = "index.html";

  app.use(compression());
  app.use(favicon(path.join(serveDir, "favicon.ico")));
  app.use(serveStatic(serveDir, { extensions: ["html"] }));
  app.use(bodyParser.json({ strict: false }));
  app.use(bodyParser.urlencoded({ extended: true }));

  app.get("/database", (req, res) => {
    res.send(database);
  });

  // proxy all client's firebase restful requests to firebase server.
  app.use("/*.json$", (req, res) => {
    // abort the request if client cancels the request.
    const controller = new AbortController();
    req.on("close", () => controller.abort());
    let bodyStr = JSON.stringify(req.body);

    getToken().then(token =>
      fetch(
        url.format({
          host: database,
          pathname: req._parsedUrl.pathname,
          // append the access token into query.
          query: { ...req.query, access_token: token }
        }),
        {
          method: req.method,
          signal: controller.signal,
          ...(bodyStr !== "{}" && { body: bodyStr })
        }
      )
        .then(resp => resp.json())
        .then(json => res.json(json))
        .catch(e => {
          if (e.name === "AbortError") {
            // request cancelled by client.
            res.end();
            return;
          }
          console.log("[Error]: ", req.url, e);
          res.status(500).send(e.toString());
        })
    );
  });
  app.get("*", (_, res) => res.sendFile(path.join(serveDir, fallbackPage)));

  app.listen(port, err => {
    if (err) {
      return console.error(err);
    }
    return console.log(`Listening at http://localhost:${port}`);
  });
};

module.exports = Server;
