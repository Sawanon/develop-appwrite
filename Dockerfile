FROM node:20.16.0-alpine3.20

WORKDIR /app

COPY . .

RUN npm ci

CMD [ "npm", "start" ]