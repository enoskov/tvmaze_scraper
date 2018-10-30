'use strict';

const config = require('../../config.js');
const db = require('../../db');
const logger4js = require('../../logger');

const factory = (dependencies = {}) => {
    const {
        $db = db(),
        $config = config(),
        $getLogger = logger4js().getLogger,
    } = dependencies;

    const logger = $getLogger($config.appName + '.api_cast_service ['+process.pid+']');

    /**
     * Get a requested page of TV shows cast
     *
     * page_size Integer Specifies the desired size of page in range [1..500]
     * start_id Integer Specifies the starting id for tv shows to return cast for for the next page. If not specified, start with the lowest id in db (initial page). (optional)
     * returns inline_response_200
     **/
    let getCast = async function (pageSize, startId) {
        let page = {};
        page['application/json'] = {
            "shows": [],
            "next_start_key": null
        };
        if (startId === undefined || startId === null) {
            logger.debug("Work with the very first page");
            startId = null;
        } else {
            logger.debug("start_id is specified");
        }
        try {
            let resp = await $db.getShowsPage(startId, pageSize + 1); // +1 to get next_start_key TODO
            if (Array.isArray(resp) && resp.length === pageSize + 1) {
                page['application/json'].next_start_key = resp[pageSize].id;
                resp.pop();
            } else {
                delete page['application/json'].next_start_key;
            }
            // Per API spec we must sort by birthday desc and print in format "YYYY-MM-DD"
            resp = resp.map((item) => {
                return {
                    id: item.id,
                    name: item.name,
                    cast: item.cast.sort((a, b) => {
                        if (a.birthday > b.birthday) return 1;
                        else if (a.birthday < b.birthday) return -1;
                        else return 0;
                    }).map((item) => {
                        return {
                            id: item.id,
                            name: item.name,
                            birthday: new Date(item.birthday).toISOString().slice(0, 10)
                        };
                    })
                };
            });
            page['application/json'].shows = resp;
            if (Object.keys(page).length > 0) {
                return page[Object.keys(page)[0]];
            }
        }
        catch (err) {
            logger.error("Database error " + err);
            return new Error("database error");
        }
    };

    /** MODULE EXPORT **/
    return {
        getCast:getCast
    };
};

module.exports = factory;
