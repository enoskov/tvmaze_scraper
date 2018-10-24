"use strict";

const mongoose = require('mongoose');
const config = require('../../config.js');
const util = require('util');
const logger4js = require('../../logger');

/** Singleton. Keep fields static. **/
let db = null;
let isConnected = false;

const factory = (dependencies = {}) => {
    const {
        $mongoose = mongoose,
        $config = config(),
        $util = util,
        $getLogger = logger4js().getLogger
    } = dependencies;

    const logger = $getLogger($config.appName + '.mongo_connection ['+process.pid+']');

    const dbUrl = $config.mongoDb.url;
    const connectionOptions = {
        server: {
            reconnectTries: $config.mongoDb.reconnectTries,
            reconnectInterval: $config.mongoDb.reconnectInterval
        }
    };

    if ($config.nodeEnvironment === "development") {
        const mongooseLogger = $getLogger($config.appName + '.db.mongoose');
        $mongoose.set('debug', function (collectionName, methodName) {
            let args = Array.from(arguments);
            let argsStr = "";
            for (let idx = 2; idx < args.length; idx++) {
                // for some reason I'm getting undefined in the args list
                // argsStr += " - " + (args[idx] ? args[idx].toString() : "");
                argsStr += " - " + $util.inspect(args[idx]);
            }
            // mongooseLogger.debug(collectionName + ", " + methodName + argsStr);
        });
    }

    /**
     * @public
     * @function module:mongo.connect
     * @desc Establishes a persistent connection to MongoDB. Initializes inner db object which is used for further
     * operations.
     */
    let connect = function () {
        db = $mongoose.createConnection(dbUrl, connectionOptions);

        db.on('connecting', function () {
            logger.info('Connecting to MongoDB at URL: ' + dbUrl);
        });

        db.on('connected', function () {
            isConnected = true;
            logger.info('Connected to MongoDB at URL: ' + dbUrl);
        });

        db.on('open', function () {
            logger.info('Connection open to MongoDB at URL: ' + dbUrl);
        });

        db.on('disconnecting', function (ref) {
            isConnected = false;
            logger.warn('disconnecting from MongoDB, URL: <' + dbUrl + '>, ref: ' + ref);
        });

        db.on('disconnected', function (ref) {
            isConnected = false;
            logger.warn('disconnected from MongoDB, URL: <' + dbUrl + '>, ref: ' + ref);
        });

        db.on('reconnected', function (ref) {
            isConnected = true;
            logger.warn('reconnected to MongoDB, URL: <' + dbUrl + '>, ref: ' + ref);
        });

        db.on('close', function () {
            isConnected = false;
            logger.warn('Connection closed to MongoDB at URL: ' + dbUrl);
        });

        db.on('error', function (err) {
            logger.error('error with MongoDB connection, URL: <' + dbUrl + '>, Error: ' + err);
        });
    };

    /**
     * @package
     * @function module:mongo.isDbConnected
     * @desc Checks whether connection to MongoDB is successfully established.
     * @return {boolean} True if connection is established and active. False otherwise.
     */
    let isDbConnected = function () {
        return !!db;
    };

    /**
     * @package
     * @function module:mongo.getDB
     * @desc Returns MongoDB connection object which is used by other functions in this module to find, update and delete
     * records.
     * @return {object} MongoDB connection object.
     */
    let getDB = function () {
        return db;
    };

    /** MODULE EXPORT **/
    return {
        getDB: getDB,
        isDbConnected: isDbConnected,
        connect: connect
    };
};

module.exports = factory;


