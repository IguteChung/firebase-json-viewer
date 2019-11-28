FROM node:10.11-alpine as compiler
WORKDIR /data
COPY package.json yarn.lock ./
RUN yarn
COPY public ./public
COPY src ./src
RUN yarn build

FROM node:10.11-alpine
WORKDIR /server
COPY --from=compiler /data/package.json /data/yarn.lock ./
RUN yarn --prod
COPY server.js ./
COPY bin ./bin
COPY --from=compiler /data/build ./build
ENTRYPOINT ["/server/bin/firebase-json-viewer.js"]
