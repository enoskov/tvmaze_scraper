'use strict';

const Bottleneck = require("bottleneck");
const rp = require('request-promise-native');
const db = require('../db');
const config = require('../config.js');
const logger4js = require('../logger');

const factory = (dependencies = {}) => {
    const {
        $Bottleneck = Bottleneck,
        $rp = rp,
        $db = db(),
        $config = config(),
        $getLogger = logger4js().getLogger
    } = dependencies;


    const logger = $getLogger($config.appName + '.scraper ['+process.pid+']');

    /** Important assumption for this scraper. The content of the page cannot be changed or some show to be
     * removed in the middle. Only new shows are added to the end time-to-time. If this assumption is incorrect,
     * need to implement another logic to rescan from the beginning instead of storing the last processed page
     * in DB. Or at least make lastProcessedPage to be TTL collection in DB so we could rescan each week or
     * month.
     */

    /* No ideas regarding rate limits for tvmaze so make it slow by default.
     Use bottleneck since it support all scheduler and rate limiter features we might want. Plus it
     supports Redis cluster if we really want it to work that way in future.
     */
    let showsLimiter = new $Bottleneck({
        maxConcurrent: $config.showsLimiter.maxConcurrent,
        minTime: $config.showsLimiter.minTime
    });

    let castLimiter = new $Bottleneck({
        maxConcurrent: $config.castLimiter.maxConcurrent,
        minTime: $config.castLimiter.minTime,
        reservoir: $config.castLimiter.reservoir,
        reservoirRefreshAmount: $config.castLimiter.reservoirRefreshAmount,
        reservoirRefreshInterval: $config.castLimiter.reservoirRefreshInterval
    });

    let globalState = {
        lastProcessedShowsPage: 0,
        lastProcessedShowId: 0
    };
    let rateLimitReachedNumber = 0;

    /**
     * @typedef module:scraper.bottleneckStatus
     * @type {object}
     * @property {string} IDLE        - Background task is not running yet.
     * @property {string} RUNNING     - Background task is activily scraping data abd pushing to db
     * @property {string} MONITORING  - Background task is monitoring for changes in TVMaze DB
     * @property {string} STOPPING    - Background task is being stopped to recover from TVMaze or db error
     */
    let bottleneckStatus = Object.freeze({
        IDLE: "idle",
        RUNNING: "running",
        MONITORING: "monitoring",
        STOPPING: "stopping"
    });

    let backgroundTaskState = bottleneckStatus.IDLE;

    async function readGlobalState() {
        logger.debug("Reading global state from db..");
        try {
            let state = await $db.readGlobalState();
            if (state === null) {
                // init to 0
                return {
                    lastProcessedShowsPage: 0,
                    lastProcessedShowId: 0
                };
            } else {
                return state;
            }
        }
        catch (err) {
            logger.error("Error while reading global state " + err);
            process.exit(1);
        }
    }

    async function dumpGlobalState() {
        logger.debug("Writing global state to db..");
        try {
            await $db.saveGlobalState(globalState);
        }
        catch(err) {
            logger.error("Error while writing global state " + err);
            return new Error("DB error");
        }
    }

    function getCastInfoTask(showsInfo) {
        /* push all show ids from one page to the scheduler */
        showsInfo.map((show) => {
            castLimiter.schedule(() => $rp({
                uri: $config.tvmazeUrl + "/" + show.id + "/cast",
                method: 'GET',
                json: true // Automatically parses the JSON string in the response
            }))
                .then((cast) => {
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
                    $db.saveShow(showWithCast)
                        .then((response) => {
                            //if (show.id > globalState.lastProcessedShowId) globalState.lastProcessedShowId = show.id;
                            logger.debug("Show with id %d successfully saved to db", show.id);
                        })
                        .catch((err) => {
                            logger.error("Failed to save show with id %d to database", show.id);
                            if (backgroundTaskState !== bottleneckStatus.STOPPING) {
                                logger.warn("Rerun the current task after timeout to recover from database error");
                                backgroundTaskState = bottleneckStatus.STOPPING;
                                castLimiter.stop({dropWaitingJobs: true})
                                    .then(() => {
                                        setTimeout(() => {
                                            // rerun the task after timeout
                                            castLimiter = new $Bottleneck({
                                                maxConcurrent: $config.castLimiter.maxConcurrent,
                                                minTime: $config.castLimiter.minTime,
                                                reservoir: $config.castLimiter.reservoir,
                                                reservoirRefreshAmount: $config.castLimiter.reservoirRefreshAmount,
                                                reservoirRefreshInterval: rateLimitReachedNumber
                                            });
                                            getCastInfoTask(showsInfo);
                                            backgroundTaskState = bottleneckStatus.RUNNING;
                                        }, $config.retryTimeoutIfDatabaseUnavailable);
                                    }, (err) => {
                                    });
                            }
                        });
                }, (err) => {
                    if (err.statusCode === 429) {
                        // Too many requests. Take it easy.
                        // Let's make it adaptive and downgrade all key parameters by 2
                        if (backgroundTaskState !== bottleneckStatus.STOPPING) {
                            logger.warn("Reached rate limit. Rerun the task with decreased frequency.");
                            backgroundTaskState = bottleneckStatus.STOPPING;
                            rateLimitReachedNumber++;
                            castLimiter.stop({dropWaitingJobs: true})
                                .then(() => {
                                    // rerun the task
                                    castLimiter = new $Bottleneck({
                                        maxConcurrent: $config.castLimiter.maxConcurrent,
                                        minTime: $config.castLimiter.minTime * rateLimitReachedNumber,
                                        reservoir: Math.round($config.castLimiter.reservoir / rateLimitReachedNumber),
                                        reservoirRefreshAmount: Math.round($config.castLimiter.reservoirRefreshAmount / rateLimitReachedNumber),
                                        reservoirRefreshInterval: rateLimitReachedNumber * $config.castLimiter.reservoirRefreshInterval
                                    });
                                    getCastInfoTask(showsInfo);
                                    backgroundTaskState = bottleneckStatus.RUNNING;
                                }, (err) => {
                                });
                        }
                    } else if (err instanceof $Bottleneck.BottleneckError && err.message === "This limiter has been stopped.") {
                        // error re stopped scheduler. Ignore it.
                    } else if (err.statusCode >= 500) {
                        // In case of server error, wait for a while and then retry
                        logger.warn("TVMaze responded with 5xx");
                        if (backgroundTaskState !== bottleneckStatus.STOPPING) {
                            logger.warn("Rerun the current task after timeout to recover from server 5xx error");
                            backgroundTaskState = bottleneckStatus.STOPPING;
                            castLimiter.stop({dropWaitingJobs: true})
                                .then(() => {
                                    setTimeout(() => {
                                        // rerun the task after timeout
                                        castLimiter = new $Bottleneck({
                                            maxConcurrent: $config.castLimiter.maxConcurrent,
                                            minTime: $config.castLimiter.minTime,
                                            reservoir: $config.castLimiter.reservoir,
                                            reservoirRefreshAmount: $config.castLimiter.reservoirRefreshAmount,
                                            reservoirRefreshInterval: rateLimitReachedNumber
                                        });
                                        getCastInfoTask(showsInfo);
                                        backgroundTaskState = bottleneckStatus.RUNNING;
                                    }, $config.retryTimeoutIfTVMazeIsUnavailable);
                                }, (err) => {
                                });
                        }
                    } else {
                        logger.error(err);
                    }
                });
        });
    }

    let checkShowsUpdateTask = function() {
        /** background task which runs forever **/
        showsLimiter.schedule(() => $rp({
            uri: $config.tvmazeUrl + "?page=" + globalState.lastProcessedShowsPage,
            method: 'GET',
            json: true // Automatically parses the JSON string in the response
        }))
            .then((showsInfo) => {
                logger.debug("Successfully get page %d", globalState.lastProcessedShowsPage);
                globalState.lastProcessedShowsPage++;
                let maxShowId = showsInfo.reduce((acc, item) => item.id > acc ? item.id : acc, 0);
                if (maxShowId > globalState.lastProcessedShowId &&
                    (backgroundTaskState === bottleneckStatus.RUNNING ||
                    backgroundTaskState === bottleneckStatus.MONITORING)) {
                    globalState.lastProcessedShowId = maxShowId;
                    backgroundTaskState = bottleneckStatus.RUNNING;
                    getCastInfoTask(showsInfo);
                }
                checkShowsUpdateTask(); // keep running task
            })
            .catch((err) => {
                if ((err.statusCode === 404) || (err.statusCode > 500)) {
                    globalState.lastProcessedShowsPage--; // stick with the prev page as it might be updated
                    if ((backgroundTaskState === bottleneckStatus.RUNNING)
                        && (castLimiter.empty())
                        && (err.statusCode === 404)) {
                        dumpGlobalState()
                            .then(resp => {
                                logger.info("Background task now in MONITORING state");
                                backgroundTaskState = bottleneckStatus.MONITORING;
                            })
                            .catch(err => {
                                logger.error("Error while dumping global state " + err);
                            });
                    } else if (backgroundTaskState === bottleneckStatus.MONITORING) {
                        logger.debug("Keep monitoring..");
                    }
                    checkShowsUpdateTask(); // keep running task
                } else {
                    logger.error("Error code %s while GET shows page %d", err.statusCode, globalState.lastProcessedShowsPage);
                }
            });
    };

    let start = async function() {
        try {
            globalState = await readGlobalState();
            // start task on background to check whether new shows have been added on timely manner
            backgroundTaskState = bottleneckStatus.RUNNING;
            checkShowsUpdateTask();
        }
        catch (err) {
            logger.fatal("Error while starting scraper task. Something is really bad. " + err);
        }
    };

    /** MODULE EXPORT **/
    return {
        start: start
    }

};

module.exports = factory;