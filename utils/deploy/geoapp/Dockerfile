FROM ubuntu:14.04
MAINTAINER David Manthey <david.manthey@kitware.com>

# The environment variables beginning with KWDEMO can be used to map this demo
# to the main url space.  See the end of this file.
ENV KWDEMO_READY FALSE

EXPOSE 8080

RUN apt-get update && apt-get install -y curl \
    software-properties-common \
    python-software-properties \
    build-essential \
    libffi-dev \
    libpython-dev \
    python-pip \
    postgresql-client \
    postgresql-common \
    libpq-dev \
    vim \
    git

# Get nodejs apt source
RUN curl -sL https://deb.nodesource.com/setup | sudo bash -
# Add mongo apt source
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10 && \
    echo "deb http://repo.mongodb.org/apt/ubuntu "$(lsb_release -sc)"/mongodb-org/3.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.0.list
# Install packages requiring additional sources
RUN apt-get update && apt-get install -y \
    mongodb-org-shell \
    mongodb-org-tools \
    nodejs

RUN pip install girder python-dateutil PyGreSQL==4.1.1 psycopg2 && \
    python -c "import bcrypt" && \
    girder-install web && \
    girder-install plugin
RUN npm install -g grunt-cli

# bower does't work particularly well as root, so we create a non-root user
# called kwuser, but give it sudo ability.
RUN adduser --disabled-password --gecos '' kwuser && \
    adduser kwuser sudo && \
    echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

USER kwuser

WORKDIR /home/kwuser

RUN mkdir /home/kwuser/logs

# XDATA's proxy can't use the git protocol
RUN git config --global url."https://".insteadOf git://

RUN git clone git://github.com/XDATA-Year-3/geoapp.git && \
    cd geoapp && \
    git checkout f9eb29047ce684fc707bc5775aee68a9e0516546 && \
    git reset --hard
WORKDIR /home/kwuser/geoapp
RUN git submodule update --init --recursive && \
    git submodule update --recursive && \
    cd geojs && \
    npm install && \
    grunt library
RUN curl https://raw.githubusercontent.com/draperlaboratory/user-ale/master/helper-libs/javascript/userale.js -o client/optional/js/userale.js && \
    curl https://raw.githubusercontent.com/draperlaboratory/user-ale/master/helper-libs/javascript/userale-worker.js -o client/optional/static/userale-worker.js

RUN npm install

COPY makelocalcfg.py /home/kwuser/makelocalcfg.py

ENV KWDEMO_NAME GeoApp Demo
ENV KWDEMO_KEY geoapp
ENV KWDEMO_SRCURL https://github.com/XDATA-Year-3/geoapp
ENV KWDEMO_DESC XDATA Year 3 taxi data explorer
ENV KWDEMO_IMG /geoapp.png
ENV KWDEMO_READY TRUE

CMD ["sh", "-c", "python /home/kwuser/makelocalcfg.py > conf/geoapp.local.cfg && python server/main.py"]