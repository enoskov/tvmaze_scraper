'use strict';
/**
 * @file app.js
 * @desc
 *   This is where the swagger/connect app is created for TVMAze scraper
 */

const path = require('path');
const config = require('../config.js');
const logger4js = require('../logger');
const cors = require('cors');
const fs = require('fs');
const http = require('http');
const os = require("os");
const connect = require('connect');
const swaggerTools = require('swagger-tools');
const swaggerMetadata = require('swagger-tools/middleware/swagger-metadata');
const swaggerRouter = require('swagger-tools/middleware/swagger-router');
const swaggerValidator = require('swagger-tools/middleware/swagger-validator');
const swaggerUi = require('swagger-tools/middleware/swagger-ui');
const jsyaml = require('js-yaml');
const mongoose = require('mongoose');

const factory = (dependencies = {}) => {
    const {
        $path = path,
        $config = config(),
        $getLogger = logger4js().getLogger,
        $cors = cors,
        $fs = fs,
        $http = http,
        $os = os,
        $connect = connect,
        $swaggerTools = swaggerTools,
        $jsyaml = jsyaml,
        $mongoose = mongoose
    } = dependencies;

    let httpServer;

    // start listen to unhandled exceptions early to catch some issues during server startup
    process.on('uncaughtException', async function(err) {
        logger.fatal("uncaughtException: %s", err.stack);
        await shutdown(1);
    });

    const logger = $getLogger($config.appName + '.api ['+process.pid+']');
    const app = $connect();

    /**
     * @private
     * @typedef options
     * @type {object}
     * @property {string} swaggerUi    - Path to swagger.json file which contains API schema definitions.
     * @property {string} controllers  - Path to a folder where controllers are implementers for API services.
     * @property {boolean} useStubs    - Whether or not allow stubs for functional tests
     * @desc swaggerRouter configuration
     */
    let options = {
        swaggerUi: $path.join(__dirname, '/swagger.json'),
        controllers: $path.join(__dirname, './controllers'),
        useStubs: $config.nodeEnvironment === 'development' // Conditionally turn on stubs (mock mode)
    };

    /* this function is synchronous */
    function start() {
        // Support CORS for development mode for now. Latter need to change if we want to support SMS in web portal
        if ($config.nodeEnvironment === 'development') {
            app.use($cors());
        }

        // The Swagger document (require it, build it programmatically, fetch it from an URL, ...)
        let spec = $fs.readFileSync($path.join(__dirname, './swagger.yaml'), 'utf8');
        let swaggerDoc = $jsyaml.safeLoad(spec);

        // Initialize the Swagger middleware
        app.use(swaggerMetadata(swaggerDoc));
        app.use(swaggerValidator());
        app.use(swaggerRouter(options));
        app.use(swaggerUi(swaggerDoc));

        if ($config.nodeEnvironment === 'development') {
            // avoid leak of api specification in Prod
            app.use('/scraper/v1/swagger', function fooMiddleware(req, res, next) {
                res.writeHead(200, {
                    "Content-Type": "application/octet-stream",
                    "Content-Disposition": "attachment; filename=" + 'swagger.yaml'
                });
                $fs.createReadStream($path.join(__dirname, './swagger/swaggerv1.yaml')).pipe(res);
                next();
            });
        }

        logger.info(`Starting REST API...`);
        httpServer = $http.createServer(app);
        httpServer.listen($config.apiHttpPort, $os.hostname(), onListeningHttp);
        httpServer.on('error', onError);

        /**
         * Event listener for HTTP server "listening" event.
         */
        function onListeningHttp() {
            let addr = httpServer.address();
            let bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
            logger.info('Listening on ' + bind);
            if ($config.nodeEnvironment === 'development') {
                logger.info('Swagger-ui is available on http://%s:%d/docs', $os.hostname(), addr.port);
                logger.info("Swagger YAML specification is available on http://%s:%d/scraper/v1/swagger", $os.hostname(), addr.port);
            }
        }

        /**
         * Event listener for HTTP server "error" event.
         */
        function onError(error) {
            if (error.syscall !== 'listen') {
                throw error;
            }

            let bind = typeof $config.apiHttpPort === 'string' ? 'Pipe ' + $config.apiHttpPort : 'Port ' + $config.apiHttpPort;
            // handle specific listen errors with friendly messages
            switch (error.code) {
                case 'EACCES':
                    logger.error(bind + ' requires elevated privileges');
                    shutdown(httpServer, 1);
                    break;
                case 'EADDRINUSE':
                    logger.error(bind + ' is already in use');
                    shutdown(httpServer, 1);
                    break;
                default:
                    throw error;
            }
        }

    }

    /**
     * Gracefully shutdown http server and mongoose if necessary.
     */
    async function shutdown(exitCode) {
        try {
            if (httpServer) {
                logger.info("Closing http server.");
                await httpServer.close();
                logger.info("Http server closed.");
                await $mongoose.connection.close(false); // boolean means force
                logger.info('MongoDb connection closed. Exit now.');
                process.exit(exitCode);
            } else {
                logger.info("Exit now.");
                process.exit(exitCode);
            }

            // if after
            setTimeout(() => {
                logger.error("Could not close connections in time, forcefully shutting down");
                process.exit(exitCode);
            }, $config.gracefulShutdownTimeout);
        } catch (e) {
            process.exit(exitCode);
        }
    }

    /** MODULE EXPORT **/
    return {
        start:start
    };

};


module.exports = factory;
