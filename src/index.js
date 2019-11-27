import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import "./index.css";

fetch("/database")
  .then(resp => resp.text())
  .then(database => {
    ReactDOM.render(
      <App databaseURL={database} />,
      document.getElementById("root")
    );
  });
