'use strict';

const Bottleneck = require("bottleneck");
const rp = require('request-promise-native');
const db = require('../db');
const config = require('../config.js');
const logger4js = require('../logger');
const State = require('./State');
const Scraper = require('./Scraper');
const EventEmitter = require('events');

const factory = (dependencies = {}) => {
    const {
        $Bottleneck = Bottleneck,
        $rp = rp,
        $db = db(),
        $config = config(),
        $getLogger = logger4js().getLogger,
        $State = State(),
        $EventEmitter = EventEmitter
    } = dependencies;


    const logger = $getLogger($config.appName + '.scraperTask [' + process.pid + ']');

    class Scraper extends $EventEmitter {
        constructor(globalState) {
            super();
            this.globalState = globalState || {
                    lastProcessedShowsPage: 0,
                    lastProcessedShowId: 0
                };
            this.state = new $State($State.STATES.IDLE);

            /* No ideas regarding rate limits for tvmaze so make it slow by default.
             Use bottleneck since it support all scheduler and rate limiter features we might want. Plus it
             supports Redis cluster if we really want it to work that way in future.
             */
            this.showsLimiter = new $Bottleneck({
                maxConcurrent: $config.showsLimiter.maxConcurrent,
                minTime: $config.showsLimiter.minTime
            });

            this.castLimiter = new $Bottleneck({
                maxConcurrent: $config.castLimiter.maxConcurrent,
                minTime: $config.castLimiter.minTime,
                reservoir: $config.castLimiter.reservoir,
                reservoirRefreshAmount: $config.castLimiter.reservoirRefreshAmount,
                reservoirRefreshInterval: $config.castLimiter.reservoirRefreshInterval
            });

            this.rateLimitReachedNumber = 0;
        }

        async checkShowsUpdateTask() {
            let maxShowId;
            switch (this.state.getState()) {
                case $State.STATES.IDLE:
                    this.state.setState($State.STATES.RUNNING);
                    logger.info("Starting background scraper task");
                    break;
                case $State.STATES.RUNNING:
                    const [statusCode, data] = await this.processNextPage(this.globalState.lastProcessedShowsPage);
                    this.emit("monitoring",this.globalState); /* no need in async event */
                    switch (statusCode) {
                        case 200:
                            maxShowId = data.reduce((acc, item) => item.id > acc ? item.id : acc, 0);
                            if (maxShowId > this.globalState.lastProcessedShowId) {
                                this.globalState.lastProcessedShowId = maxShowId;
                                this.queueShows(data);
                            }
                            this.globalState.lastProcessedShowsPage++; // go to the next page
                            break;
                        case 404:
                            // we reached the end of pages
                            this.globalState.lastProcessedShowsPage--; // stick with the prev page as it might be updated
                            this.state.setState($State.STATES.STOPPING);
                            break;
                        default:
                        // server error 5xx or any other - keep pushing
                    }
                    break;
                case $State.STATES.STOPPING:
                    if (this.isIdle()) {
                        this.emit("monitoring",this.globalState); /* no need in async event */
                        this.state.setState($State.STATES.MONITORING);
                    }
                    break;
                case $State.STATES.MONITORING:
                    logger.info("Keep monitoring..");
                    const [, newPage] = await this.processNextPage(globalState.lastProcessedShowsPage);
                    maxShowId = newPage.reduce((acc, item) => item.id > acc ? item.id : acc, 0);
                    if (maxShowId > this.globalState.lastProcessedShowId) {
                        logger.info("New shows have arrived!");
                        this.state.setState($State.STATES.RUNNING);
                    }
                    break;
                default:
                    logger.fatal("Invalid State!");
            }
            // run forever
            this.checkShowsUpdateTask().catch(e => logger.error(e));
        }

        isIdle() {
            return (this.showsLimiter.empty() && this.castLimiter.empty());
        }

        async processNextPage(page) {
            try {
                const showsInfo = await this.showsLimiter.schedule(() => this.getPage(page));
                logger.debug("Successfully get page %d", this.globalState.lastProcessedShowsPage);
                return [200, showsInfo];
            }
            catch(err) {
                if (err.statusCode === 404) {
                    return [404, null];
                } else {
                    logger.error("Error code %s while GET shows page %d", err.statusCode, this.globalState.lastProcessedShowsPage);
                    return [err.statusCode, null];
                }
            }
        }

        async getPage(page) {
            return await $rp({
                uri: $config.tvmazeUrl + "?page=" + this.globalState.lastProcessedShowsPage,
                method: 'GET',
                json: true // Automatically parses the JSON string in the response
            });
        }

        queueShows(showsInfo) {
            /* push all show ids from one page to the scheduler */
            showsInfo.map(show => this.processShow(show));
        }

        async processShow(show) {
            try {
                const cast = await this.castLimiter.schedule(() => Scraper.getCast(show.id));
                let showWithCast = {
                    id: show.id,
                    name: show.name,
                    cast: cast.reduce((acc, cast_item) => {
                        acc.push({
                            id: cast_item.person.id,
                            name: cast_item.person.name,
                            birthday: Date.parse(cast_item.person.birthday) || null
                        });
                        return acc;
                    }, [])
                };
                await $db.saveShow(showWithCast);
                logger.debug("Show with id %d successfully saved to db", show.id);
            }
            catch(err) {
                if (err instanceof $Bottleneck.BottleneckError && err.message === "This limiter has been stopped.") {
                    // error re stopped scheduler. Ignore it
                    // TODO rework all error in this solution to be instanceof some class like BottleneckError to make
                    // this if else tree good looking
                } else if (err.message === 'db error') {
                    //retry after timeout
                    setTimeout(() => this.queueShows([show]), $config.retryTimeoutIfDatabaseUnavailable);
                } else if (err.statusCode) {
                    switch (err.statusCode) {
                        case 429:
                            // Too many requests. Take it easy.
                            // Let's make it adaptive and downgrade all key parameters by 2 each time
                            this.rateLimitReachedNumber++;
                            await this.castLimiter.updateSettings({
                                maxConcurrent: $config.castLimiter.maxConcurrent,
                                minTime: $config.castLimiter.minTime * this.rateLimitReachedNumber,
                                reservoir: Math.round($config.castLimiter.reservoir / this.rateLimitReachedNumber),
                                reservoirRefreshAmount: Math.round($config.castLimiter.reservoirRefreshAmount / this.rateLimitReachedNumber),
                                reservoirRefreshInterval: this.rateLimitReachedNumber * $config.castLimiter.reservoirRefreshInterval
                            });
                            break;
                        default:
                            // In case of server error, wait for a while and then retry
                            logger.warn("TVMaze responded with " + err.statusCode);
                    }
                    //retry after timeout
                    setTimeout(() => this.queueShows([show]), $config.retryTimeoutIfTVMazeIsUnavailable);
                } else {
                    logger.error(err);
                }
            }
        }

        static async getCast(showId) {
            return await $rp({
                uri: $config.tvmazeUrl + "/" + showId + "/cast",
                method: 'GET',
                json: true // Automatically parses the JSON string in the response
            });
        }

        async run() {
            this.checkShowsUpdateTask().catch(e => logger.fatal("Something really wrong!!"));
        }
    }

    /** MODULE EXPORT **/
    return Scraper;
};

module.exports = factory;
