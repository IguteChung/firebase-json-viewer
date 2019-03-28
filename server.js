const path = require("path");
const express = require("express");
const compression = require("compression");
const favicon = require("serve-favicon");
const serveStatic = require("serve-static");
const { google } = require("googleapis");
const admin = require("firebase-admin");

const Server = (database, serviceAccountPath) => {
  // Load the service account key JSON file.
  const serviceAccount = serviceAccountPath ? require(serviceAccountPath) : null;

  admin.initializeApp({
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount)
      : {
          getAccessToken: () => ({
            expires_in: 1000000,
            access_token: "",
          }),
        },
    databaseURL: database,
  });

  const db = admin.database();

  // Define the required scopes.
  const scopes = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/firebase.database",
  ];

  // Authenticate a JWT client with the service account.
  const jwtClient =
    serviceAccount && new google.auth.JWT(serviceAccount.client_email, null, serviceAccount.private_key, scopes);

  let cachedToken = null;
  const getToken = () => {
    if (!serviceAccount) {
      return Promise.resolve("");
    }
    if (cachedToken && cachedToken.expiry_date > Date.now()) {
      return Promise.resolve(cachedToken.access_token);
    }
    return new Promise((resolve, reject) => {
      jwtClient.authorize((error, token) => {
        if (error) {
          reject(`Error making request to generate access token: ${error}`);
        } else if (token.access_token === null) {
          reject("Provided service account does not have permission to generate access tokens");
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
  app.get("/token", (req, res) => {
    getToken().then(token => {
      res.send(token);
    });
  });
  app.get("/database", (req, res) => {
    res.send(database);
  });
  app.delete("*", (req, res) => {
    db.ref(req.originalUrl).set(null);
    res.end();
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
