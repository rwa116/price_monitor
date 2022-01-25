CREATE DATABASE pricemonitor;

CREATE TABLE Guilds (
    guildId VARCHAR(20) NOT NULL PRIMARY KEY,
    guildOwnerId VARCHAR(20) NOT NULL
);

CREATE TABLE MonitorInfo (
    guildId VARCHAR(20) NOT NULL PRIMARY KEY,
    guildNotif VARCHAR(10) NOT NULL DEFAULT 'false',
    guildJob VARCHAR(20) NOT NULL DEFAULT 'CLEAR',
    guildJobName VARCHAR(200),
    guildCaller VARCHAR(100),
    guildThresh VARCHAR(50),
    guildInterval VARCHAR(50),
    guildUrl VARCHAR(500)
);
