# tvmaze_scraper

Background
==========
For a new metadata ingester we need a service that provides the cast of all the tv shows in the TVMaze
database, so we can enrich our metadata system with this information. The TVMaze database provides a
public REST API that you can query for this data.

Prerequisites 
=============
NodeJS LTS 8.12.0
MongoDB replica set

Installation
============
git clone https://github.com/enoskov/tvmaze_scraper.git
cd tvmaze_scraper
npm install

Deploy DB schema to mongo replica set:
Mongo>use admin
Mongo>load("tvmaze_scraper/db/mongo/mongo_deploy/deploy.js")
Mongo>deployment.createAdmin("admin","<your pass>") 
Mongo>deployment.deploy("admin","<your pass>", "scraper")

Start
=====
TvMaze scraper could be run in two modes:
* two apps in one nodejs process (for dev purposes)
* each app (scraper and API) could be run in a separate process. API module can be scaled if necessary by running multiple instances and using load balancing proxy (nginx, haproxy)

*Run all in one process. forever will restart apps in case of unexpected exception.*
```bash
npm install
npm run forever
```

*Run with stdout/stderr to console*
```bash
node index.js
```

*Run scraper app. forever will restart the app whenever necessary to recover from exception.*
```bash
npm run app_scraper
```

*Run api app. forever will restart the app whenever necessary to recover from exception.*
```bash
npm run app_api
```

*You may use bash scripts to configure by specifying env variables and run apps:*
```bash
bash -x ./bin/app_api
bash -x ./bin/app_scraper
```

Stop
====
```bash
npm run stop
```

API
===
API supports GET shows with cast using pagination. Cast in the response are sorted ascending. <br/>
Please refer to the test deployment in Amazon AWS:

# Base url
http://ec2-18-224-94-56.us-east-2.compute.amazonaws.com/scraper/v1/cast<br/>

Parameters:<br/>
start_id (integer) optional<br/>
Specifies the starting id for tv shows to return cast for for the next page. If not specified, start with the lowest id in db (initial page).<br/>

page_size (integer) required<br/>
Specifies the desired size of page in range [1…500]<br/><br/>

Examples:<br/>
Get first page: http://ec2-18-224-94-56.us-east-2.compute.amazonaws.com/scraper/v1/cast?page_size=25<br/>
In a response next_start_key is specified if there is more data to load.<br/><br/>

Get subsequent pages:<br/>
http://ec2-18-224-94-56.us-east-2.compute.amazonaws.com/scraper/v1/cast?page_size=25&start_id=27<br/><br/>

Response example:

```javascript
{
  "shows": [
    {
      "id": 1,
      "name": "Under the Dome",
      "cast": [
        {
          "id": 14,
          "name": "Jeff Fahey",
          "birthday": "1952-11-29"
        },
        {
          "id": 9,
          "name": "Dean Norris",
          "birthday": "1963-04-08"
        },
        {
          "id": 6,
          "name": "Nicholas Strong",
          "birthday": "1970-01-01"
        },
        {
          "id": 12,
          "name": "Aisha Hinds",
          "birthday": "1975-11-13"
        },
        {
          "id": 4,
          "name": "Eddie Cahill",
          "birthday": "1978-01-15"
        },
        {
          "id": 2,
          "name": "Rachelle Lefevre",
          "birthday": "1979-02-01"
        },
        {
          "id": 1,
          "name": "Mike Vogel",
          "birthday": "1979-07-17"
        },
        {
          "id": 13,
          "name": "Jolene Purdy",
          "birthday": "1983-12-09"
        },
        {
          "id": 10,
          "name": "Natalie Martinez",
          "birthday": "1984-07-12"
        },
        {
          "id": 3,
          "name": "Alex Koch",
          "birthday": "1988-02-24"
        },
        {
          "id": 35903,
          "name": "Kylie Bunbury",
          "birthday": "1989-01-30"
        },
        {
          "id": 8,
          "name": "Karla Crome",
          "birthday": "1989-06-22"
        },
        {
          "id": 11,
          "name": "Britt Robertson",
          "birthday": "1990-04-18"
        },
        {
          "id": 5,
          "name": "Colin Ford",
          "birthday": "1996-09-12"
        },
        {
          "id": 7,
          "name": "Mackenzie Lintz",
          "birthday": "1996-11-22"
        }
      ]
    },
    {
      "id": 2,
      "name": "Person of Interest",
      "cast": [
        {
          "id": 93,
          "name": "Michael Emerson",
          "birthday": "1954-09-07"
        },
        {
          "id": 90,
          "name": "Kevin Chapman",
          "birthday": "1962-07-29"
        },
        {
          "id": 88,
          "name": "James Caviezel",
          "birthday": "1968-09-26"
        },
        {
          "id": 89,
          "name": "Taraji P. Henson",
          "birthday": "1970-09-11"
        },
        {
          "id": 91,
          "name": "Amy Acker",
          "birthday": "1976-12-05"
        },
        {
          "id": 91,
          "name": "Amy Acker",
          "birthday": "1976-12-05"
        },
        {
          "id": 92,
          "name": "Sarah Shahi",
          "birthday": "1980-01-10"
        }
      ]
    }
  ],
  "next_start_key": 3
}
```

# Interesting
Bug in data found while testing TvMaze Db
Invalid birthday for the following person:
{"person":{"id":70478,"url":"http://www.tvmaze.com/people/70478/christine-pollon","name":"Christine Pollon","country":{"name":"United Kingdom","code":"GB","timezone":"Europe/London"},"birthday":"1927-00-00","deathday":"2012-00-00"
