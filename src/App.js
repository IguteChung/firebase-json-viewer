import path from "path";
import React, { Component } from "react";
import JSONTree from "react-json-tree";
import "./App.css";

const LOADING_LABEL = "_LOADING_LABEL_";
const LOADING_VALUE = "_LOADING_VALUE_";

const MODE_REALTIME = "realtime";
const MODE_OFFLINE = "offline";

const DEFAULT_REFRESH_INTERVAL = 10000;
const DEFAULT_REALTIME_DELAY = 1000;

class App extends Component {
  constructor(props) {
    super(props);
    this.state = { mode: MODE_REALTIME, data: {} };
  }

  componentDidMount() {
    // load the firebase data by pathname.
    this.getFirebase(window.location.pathname, true);

    // refresh the data tree periodically.
    this.intervalID = setInterval(() => {
      const { mode } = this.state;
      if (mode === MODE_REALTIME) {
        this.getFirebase(window.location.pathname, true);
      } else {
        // clean the timer in offline mode.
        clearInterval(this.intervalID);
      }
    }, DEFAULT_REFRESH_INTERVAL);
  }

  componentWillUnmount() {
    clearInterval(this.intervalID);
  }

  deleteFirebase(dataRef) {
    const { mode } = this.state;
    fetch(dataRef + ".json", { method: "DELETE" })
      .then(() => {
        // force refresh after a successful delete.
        if (mode === MODE_REALTIME) {
          this.getFirebase(window.location.pathname, true);
        } else {
          this.getFirebase(path.dirname(dataRef), false);
        }
      })
      .catch(err => alert(err));
  }

  setFirebase(dataRef, value) {
    // remove the quotes and convert to a primitive.
    let v;
    try {
      v = JSON.parse(value);
    } catch (e) {
      if (e.name !== "SyntaxError") {
        alert(e);
        return;
      }

      // handle string without quotes.
      v = JSON.parse(`"${value}"`);
    }

    const { mode } = this.state;
    fetch(dataRef + ".json", {
      method: "PUT",
      body: JSON.stringify(v),
      headers: {
        "content-type": "application/json"
      }
    })
      .then(() => {
        // force refresh after a successful set.
        if (mode === MODE_REALTIME) {
          this.getFirebase(window.location.pathname, true);
        } else {
          this.getFirebase(path.dirname(dataRef), false);
        }
      })
      .catch(err => alert(err));
  }

  getFirebase(dataRef, realtime) {
    const { pathname } = window.location;

    // abort the fetch if non-shallow query is timeout.
    const controller = new AbortController();
    const signal = controller.signal;
    setTimeout(() => controller.abort(), DEFAULT_REALTIME_DELAY);

    Promise.all([
      fetch(`${dataRef}.json?shallow=true`)
        .then(resp => resp.json())
        .then(json => ({ mode: MODE_OFFLINE, json: json })),
      realtime
        ? fetch(`${dataRef}.json`, {
            signal
          })
            .then(resp => resp.json())
            .then(json => ({ mode: MODE_REALTIME, json: json }))
            .catch(e => {
              if (e.name === "AbortError") {
                return "";
              }
              throw e;
            })
        : Promise.resolve(false)
    ])
      .then(results => results[1] || results[0])
      .then(result => {
        const { json, mode } = result;

        // if result is from shallow query, replace the "true" value by a special object.
        if (result.mode === MODE_OFFLINE) {
          Object.keys(json)
            .filter(key => json[key] === true)
            .forEach(key => (json[key] = { [LOADING_LABEL]: LOADING_VALUE }));
        }

        // find the relative path between root and dataRef.
        const relativePath = path.relative(pathname, dataRef);
        if (!relativePath) {
          // case for load at root level.
          return this.setState({ data: json, mode });
        }

        // case for load at child path.
        let { data } = this.state;
        relativePath
          .split("/")
          .filter(p => p)
          .forEach((p, i, s) => {
            if (i === s.length - 1) {
              // update the child node by retrieved json.
              data[p] = json;
              this.setState({ data: this.state.data, mode });
              return;
            }
            // iterate to find the child node for update.
            if (!data[p]) {
              data[p] = {};
            }
            data = data[p];
          });
      })
      .catch(err => alert(err));
  }

  render() {
    const { databaseURL } = this.props;
    const { data, mode } = this.state;
    const { pathname } = window.location;
    const paths = pathname.split("/");
    return (
      <div>
        {// render offline banner
        mode === MODE_OFFLINE && (
          <div className="offline-banner">
            <img alt="info" className="offline-img" src="/info.png" />
            <div className="offline-text">
              <p className="offline-title">
                Read-only & non-realtime mode activated in the data viewer to
                improve browser performance
              </p>
              <p className="offline-subtitle">
                Select a key with fewer records to edit or view in realtime
              </p>
            </div>
          </div>
        )}
        {// render breadcrumb
        pathname !== "/" && (
          <div className="breadcrumb-banner">
            {paths.map((key, i) => (
              <span key={key}>
                {key && <span className="breadcrumb-arrow">{" > "}</span>}
                <a
                  className="breadcrumb"
                  href={path.join("/", ...paths.slice(0, i + 1))}
                >
                  {key || databaseURL}
                </a>
              </span>
            ))}
          </div>
        )}
        <JSONTree
          data={data}
          theme={{
            extend: { base00: "#000000" },
            arrow: ({ style }, nodeType, expanded) => ({
              style: {
                backgroundImage: "url(/tree-sprites.png)",
                backgroundPosition: expanded ? "0 0" : "-33px 0",
                backgroundRepeat: "no-repeat",
                width: "24px",
                height: "28px",
                // display: "inline-block",
                lineHeight: "26px"
              }
            }),
            arrowSign: {
              color: "transparent"
            },
            nestedNode: (
              { style },
              keyPath,
              nodeType,
              expanded,
              expandable
            ) => {
              return keyPath.length === 1
                ? { style } // root case
                : {
                    style: {
                      ...style,
                      backgroundImage: "url(/tree-sprites.png)",
                      backgroundPosition: "-99px 0px",
                      marginBottom: "-4px",
                      backgroundRepeat: "repeat-y",
                      marginLeft: "1.875em"
                    }
                  };
            }
          }}
          getItemString={(type, data, itemType, itemString) => ""}
          labelRenderer={(raw, type) => {
            switch (raw[0]) {
              case "root": // root label case
                if (!data || Object.keys(data).length === 0) {
                  return <div className="loader" />;
                }
                return (
                  <div className="label">
                    <a href={pathname} onClick={e => e.stopPropagation()}>
                      {paths[paths.length - 1] || databaseURL}
                    </a>
                  </div>
                );
              case LOADING_LABEL: // shallow child node case
                this.getFirebase(
                  path.join(
                    pathname,
                    ...raw.slice(1, raw.length - 1).reverse()
                  ),
                  false
                );
                return <div className="loader" />;
              default:
                const ref = path.join(
                  pathname,
                  ...raw
                    .slice(0, raw.length - 1)
                    .reverse()
                    .map(p => p.toString())
                );
                const nested = type === "Object" || type === "Array";
                return (
                  <div className="label">
                    {!nested && (
                      <div className="label-icon">
                        <div className="label-line" />
                        <div className="label-arrow" />
                      </div>
                    )}
                    <a onClick={e => e.stopPropagation()} href={ref}>
                      {raw[0] + (nested ? "" : ":")}
                    </a>
                    <img
                      alt="delete"
                      src="/delete.png"
                      onClick={e => {
                        e.stopPropagation();
                        this.deleteFirebase(ref);
                      }}
                    />
                  </div>
                );
            }
          }}
          valueRenderer={(raw, data, ...labels) => {
            switch (raw) {
              case `"${LOADING_VALUE}"`:
                return "";
              default:
                const ref = path.join(
                  pathname,
                  ...labels
                    .slice(0, labels.length - 1)
                    .reverse()
                    .map(p => p.toString())
                );
                return (
                  <input
                    className="value"
                    type="textbox"
                    defaultValue={raw}
                    onBlur={e => {
                      if (raw !== e.target.value) {
                        this.setFirebase(ref, e.target.value);
                      }
                    }}
                    onKeyPress={v => {
                      if (v.key === "Enter") {
                        v.target.blur();
                      }
                    }}
                  />
                );
            }
          }}
        />
      </div>
    );
  }
}

export default App;
