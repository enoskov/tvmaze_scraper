'use strict';

const factory = (dependencies = {}) => {
    const {
        $process = process
    } = dependencies;


    const configParams = {
        appName: "TVMaze scrapper",

        tvmazeUrl: $process.env.TVMAZE_SHOWS_URL || "http://api.tvmaze.com/shows",

        scraperWorkersNum: $process.env.TVMAZE_SCRAPER_WORKERS_NUM || 1,
        apiWorkersNum: $process.env.TVMAZE_API_WORKERS_NUM || 2,

        mongoDb: {
            url: $process.env.TVMAZE_DB_URL || "mongodb://scraper:tvmaze@snp1-frame.frame.ooma.com:27017,snp2-frame.frame.ooma.com:27017,snp3-frame.frame.ooma.com:27017/scraper?replicaSet=messagingAndPush",
            rconnectTries: 3600,
            rconnectInterval: 1000
        },

        apiHttpPort: $process.env.TVMAZE_API_PORT || 8020,
        maxPageSize: $process.env.TVMAZE_API_MAX_PAGE_SIZE || 500,
        minPageSize: $process.env.TVMAZE_API_MIN_PAGE_SIZE || 0,

        logConfig: {
            isEnabled: $process.env.TVMAZE_LOG_FILENAME_ENABLED || true,
            filename: $process.env.TVMAZE_LOG_FILENAME || '/var/log/tvmaze_scraper.log',
            level: $process.env.TVMAZE_LOG_LEVEL || 'DEBUG',
            maxFileSize: 10000000,
            numFiles: 1
        },

        syslog: {
            isEnabled: $process.env.TVMAZE_SYSLOG_ENABLED || false,
            type: 'log4js-syslog-appender',
            tag: 'tvmaze_scraper',
            facility: 'local0',
            hostname: 'localhost',
            address: 'syslog',
            port: 514,
            layout: function (logEvent) {
                return `[${logEvent.level.levelStr}][${logEvent.categoryName}] : ${logEvent.data}`;
            }
        },

        showsLimiter: {
            maxConcurrent: $process.env.TVMAZE_SHOWS_MAX_CONCURRENT || 1,
            minTime: $process.env.TVMAZE_SHOWS_MIN_TIME || 5000
        },

        castLimiter: {
            maxConcurrent: $process.env.TVMAZE_CAST_MAX_CONCURRENT || 4,
            minTime: $process.env.TVMAZE_CAST_MIN_TIME || 300,
            reservoir: $process.env.TVMAZE_CAST_RESERVOIR || 1000,
            reservoirRefreshAmount: $process.env.TVMAZE_CAST_RESERVOIR_REFRESH || 1000,
            reservoirRefreshInterval: $process.env.TVMAZE_CAST_RESERVOIR_REFRESH_TIME || (60 * 1000)
        },

        retryTimeoutIfTVMazeIsUnavailable: $process.env.TVMAZE_DOWN_RETRY_TIMEOUT || (60 * 1000),
        retryTimeoutIfDatabaseUnavailable: $process.env.TVMAZE_DB_RETRY_TIMEOUT || (60 * 1000),

        gracefulShutdownTimeout: $process.env.TVMAZE_GRACEFUL_SHUTDOWN_TIMEOUT || (33 * 1000),

        nodeEnvironment: $process.env.TVMAZE_CAST_NODE_ENV || 'development'
    };

    /** MODULE EXPORT **/
    return configParams;
};

module.exports = factory;