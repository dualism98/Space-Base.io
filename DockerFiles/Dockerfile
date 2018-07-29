FROM node:8
# Update aptitude with new repo
RUN apt-get update
# Install software   
RUN apt-get install -y git

ARG ssh_prv_key
# ARG ssh_pub_key

RUN mkdir ./root/.ssh && \
    chmod 0700 ./root/.ssh

# Copy over private key, and set permissions
ADD .ssh/id_rsa ./root/.ssh/id_rsa
RUN chmod 600 /root/.ssh/id_rsa 

# Create known_hosts
RUN touch /root/.ssh/known_hosts
# Add github key
RUN ssh-keyscan -t rsa github.com >> ~/.ssh/known_hosts

WORKDIR /app

RUN git clone --verbose git@github.com:tsamop/Zach-NodeWebGame.git . && \
    ls

RUN npm install

#CMD npm start
CMD ["npm", "start"]

EXPOSE 8080