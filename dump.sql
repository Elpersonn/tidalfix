CREATE TABLE embeds (id INTEGER PRIMARY KEY, created INTEGER, title TEXT, description TEXT, image TEXT);
CREATE TABLE blacklisted (ID INTEGER PRIMARY KEY);
CREATE TABLE artists (id INTEGER PRIMARY KEY, created INTEGER, name TEXT, description TEXT, image TEXT);
CREATE TABLE artist_blacklist (ID INTEGER PRIMARY KEY);
CREATE TABLE tracks (id INTEGER PRIMARY KEY, created INTEGER, title TEXT, description TEXT, image TEXT);
CREATE TABLE track_blacklist(ID INTEGER PRIMARY KEY NOT NULL);
