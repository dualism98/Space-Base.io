FROM node:8

# Create app directory
WORKDIR /usr/src/app


# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
RUN npm install pm2 -g
RUN pm2 update

# If you are building your code for production
# RUN npm install --only=production

# Bundle app source
COPY . .

#RUN pm2 link hidden 8q1avft2guza8y6

EXPOSE 8080
#CMD ["pm2-runtime", "--public", "d6ssou4xm41fu42", "--secret", "ycq6ns3d9gyehak", "server.js"]
#CMD [ "npm", "start" ]
CMD ["pm2-runtime", "server.js"]