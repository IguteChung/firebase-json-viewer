# firebase-json-viewer

An implementation of Firebase realtime database viewer simulating the Firebase console

# Usage

```
firebase-json-viewer -d [DATABASE_NAME] -s [SERVICE_ACCOUNT]
```

# Example

```
docker run -ti -p 8080:8080 -v [SERVICE_ACCOUNT]:/etc/sa.json frankchung/firebase-json-viewer -d https://<DATABASE>.firebaseio.com -s /etc/sa.json
```

# Features

- Support real-time and offline (shallow) mode.
- Support delete/set the value of node.

![image](https://github.com/IguteChung/firebase-json-viewer/blob/master/assets/example.png)
