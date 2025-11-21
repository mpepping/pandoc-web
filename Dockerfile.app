FROM node:25-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY server.js ./
COPY index.html ./

RUN mkdir -p temp

EXPOSE 3000

CMD ["npm", "start"]
