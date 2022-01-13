CREATE DATABASE pricemonitor;

CREATE TABLE Guilds (
    guildId VARCHAR(100) NOT NULL PRIMARY KEY,
    guildOwnerId VARCHAR(100) NOT NULL
);

CREATE TABLE MonitorInfo (
    guildId VARCHAR(100) NOT NULL PRIMARY KEY,
    guildJob VARCHAR(1000) NOT NULL DEFAULT 'CLEAR',
    guildJobName VARCHAR(200),
    guildNotif VARCHAR(10) NOT NULL DEFAULT 'false',
    guildCaller VARCHAR(100),
    guildThresh VARCHAR(100),
    guildInterval VARCHAR(100),
    guildUrl VARCHAR(1000)
);
