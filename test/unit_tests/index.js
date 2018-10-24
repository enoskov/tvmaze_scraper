'use strict';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;
const rewire = require('rewire');

function runUnitTest() {
    describe('TV Maze scraper Test Suite', () => {
        before(function() {
            // runs before all tests in this block
        });

        test_Api();

        after(function() {
            // runs after all tests in this block
        });
    });
}

function test_Api() {
    describe('Check api/controllers/Cast.js', function(done) {
        describe('Check if service rejects request to get data, 500 is sent back (using DI)', function(done) {
            // You can use dependency injection to test your module. For that specify mocked up deps
            // while call to a factory function. If no deps are specified, default ones are used.
            let _saveResponseCode;
            let $utils, $CastService, $getLogger, $config, CastController;
            before(function () {
                $utils = {
                    writeJson: function(res, data) {},
                    respondWithCode: function(respCode, json) {
                        _saveResponseCode = respCode;
                    }
                };
                $CastService = {
                    getCast: function (pageSize, startId) {
                        // emulate db error
                        return Promise.reject("database error");
                    }
                };
                $getLogger = function(moduleName) {
                    //ignore logs for now
                    return {
                        debug: () => {},
                        warn: () => {},
                        error: () => {},
                        fatal: () => {}
                    };
                };
                $config = require('../../config.js')(); // use default config dep (because we can :)) or we can decide not
                                                        // to pass it and default one will be used
            });
            after(function () {
                delete require.cache[require.resolve('../../api/controllers/Cast.js')]; // use it if you want to wipe out some static init
            });
            it('Check if service rejects request to get data, 500 is sent back', function (done) {
                CastController = require('../../api/controllers/Cast.js')({
                    $utils: $utils,
                    $Cast: $CastService,
                    $getLogger: $getLogger,
                    $config: $config}
                );
                let swaggerReq = {
                    swagger:{params:{page_size:{value:25},start_id:{value:0}}}
                };
                CastController.getCast(swaggerReq,{}/*any res*/, () => {
                    expect(_saveResponseCode).to.equal(500);
                    done();
                });
            });
            it('Check if service crashes while getting data, 500 is sent back', function (done) {
                $CastService = {
                    getCast: function (pageSize, startId) {
                        return new Promise(function (resolve, reject) {
                            null.crashme;
                        });
                    }
                };
                CastController = require('../../api/controllers/Cast.js')({
                    $utils: $utils,
                    $Cast: $CastService,
                    $getLogger: $getLogger,
                    $config: $config}
                );
                let swaggerReq = {
                    swagger:{params:{page_size:{value:25},start_id:{value:0}}}
                };
                CastController.getCast(swaggerReq,{}/*any res*/, () => {
                    expect(_saveResponseCode).to.equal(500);
                    done();
                });
            });
        });
        describe('Check if service rejects request to get data, 500 is sent back (using rewire)', function(done) {
            let _saveResponseCode;
            let utilsMock, CastServiceMock, CastController;
            before(function () {
                /** Instead of injecting deps, just mock them **/
                utilsMock = () => {
                    return {
                        writeJson: (res, data) => {
                        },
                        respondWithCode: (respCode, json) => {
                            _saveResponseCode = respCode;
                        }
                    };
                };
                CastServiceMock = () => {
                    return {
                        getCast: (pageSize, startId) => {
                            // emulate db error
                            return Promise.reject("database error");
                        }
                    }
                };
            });
            after(function () {
                delete require.cache[require.resolve('../../api/controllers/Cast.js')]; // use it if you want to wipe out some static init
            });
            it('Check if service rejects request to get data, 500 is sent back', function (done) {
                CastController = rewire('../../api/controllers/Cast.js');
                CastController.__set__('utils', utilsMock);
                CastController.__set__('Cast', CastServiceMock);
                CastController = CastController();
                let swaggerReq = {
                    swagger:{params:{page_size:{value:25},start_id:{value:0}}}
                };
                CastController.getCast(swaggerReq,{}/*any res*/, () => {
                    expect(_saveResponseCode).to.equal(500);
                    done();
                });
            });
        });
        describe('Check if pageSize is out-of-range, 400 is sent back', function(done) {
            let _saveResponseCode;
            let $utils, $CastService, $getLogger, $config, CastController;
            before(function () {
                $utils = {
                    writeJson: function(res, data) {},
                    respondWithCode: function(respCode, json) {
                        _saveResponseCode = respCode;
                    }
                };
                $CastService = {
                    getCast: function (pageSize, startId) {
                        return Promise.resolve();
                    }
                };
                $getLogger = function(moduleName) {
                    //ignore logs for now
                    return {
                        debug: () => {},
                        warn: () => {},
                        error: () => {},
                        fatal: () => {}
                    };
                };
                $config = require('../../config.js')(); // use default config dep (because we can :)) or we can decide not
                                                        // to pass it and default one will be used
                CastController = require('../../api/controllers/Cast.js')({
                    $utils: $utils,
                    $Cast: $CastService,
                    $getLogger: $getLogger,
                    $config: $config}
                );
            });
            after(function () {
                delete require.cache[require.resolve('../../api/controllers/Cast.js')]; // use it if you want to wipe out some static init
            });
            it('If pageSize < 0, 400 is sent back', function (done) {
                let swaggerReq = {
                    swagger:{params:{page_size:{value:-10},start_id:{value:0}}}
                };
                CastController.getCast(swaggerReq,{}/*any res*/, () => {
                    expect(_saveResponseCode).to.equal(400);
                    done();
                });
            });
            it('If pageSize > MAX, 400 is sent back', function (done) {
                let swaggerReq = {
                    swagger:{params:{page_size:{value:$config.maxPageSize + 1},start_id:{value:0}}}
                };
                CastController.getCast(swaggerReq,{}/*any res*/, () => {
                    expect(_saveResponseCode).to.equal(400);
                    done();
                });
            });
        });
        describe('Check if start_id is out-of-range, 400 is sent back', function(done) {
            let _saveResponseCode;
            let $utils, $CastService, $getLogger, $config, CastController;
            before(function () {
                $utils = {
                    writeJson: function(res, data) {},
                    respondWithCode: function(respCode, json) {
                        _saveResponseCode = respCode;
                    }
                };
                $CastService = {
                    getCast: function (pageSize, startId) {
                        return Promise.resolve();
                    }
                };
                $getLogger = function(moduleName) {
                    //ignore logs for now
                    return {
                        debug: () => {},
                        warn: () => {},
                        error: () => {},
                        fatal: () => {}
                    };
                };
                $config = require('../../config.js')(); // use default config dep (because we can :)) or we can decide not
                                                        // to pass it and default one will be used
                CastController = require('../../api/controllers/Cast.js')({
                    $utils: $utils,
                    $Cast: $CastService,
                    $getLogger: $getLogger,
                    $config: $config}
                );
            });
            after(function () {
                delete require.cache[require.resolve('../../api/controllers/Cast.js')]; // use it if you want to wipe out some static init
            });
            it('If start_id < 0, 400 is sent back', function (done) {
                let swaggerReq = {
                    swagger:{params:{page_size:{value:25},start_id:{value:-5}}}
                };
                CastController.getCast(swaggerReq,{}/*any res*/, () => {
                    expect(_saveResponseCode).to.equal(400);
                    done();
                });
            });
        });
        describe('Check if params are ok, 200 is sent back with cast', function(done) {
            let _saveResponseData;
            let testResponseJSON;
            let $utils, $CastService, $getLogger, $config, CastController;
            before(function () {
                testResponseJSON = require('./default.json');
                $utils = {
                    writeJson: function(res, data) {
                        _saveResponseData = data;
                    },
                    respondWithCode: function(respCode, json) {
                    }
                };
                $CastService = {
                    getCast: function (pageSize, startId) {
                        return Promise.resolve(testResponseJSON);
                    }
                };
                $getLogger = function(moduleName) {
                    //ignore logs for now
                    return {
                        debug: () => {},
                        warn: () => {},
                        error: () => {},
                        fatal: () => {}
                    };
                };
                $config = require('../../config.js')(); // use default config dep (because we can :)) or we can decide not
                                                        // to pass it and default one will be used
                CastController = require('../../api/controllers/Cast.js')({
                    $utils: $utils,
                    $Cast: $CastService,
                    $getLogger: $getLogger,
                    $config: $config}
                );
            });
            after(function () {
                delete require.cache[require.resolve('../../api/controllers/Cast.js')]; // use it if you want to wipe out some static init
            });
            it('200 Ok with cast is returned', function (done) {
                let swaggerReq = {
                    swagger:{params:{page_size:{value:25},start_id:{value:0}}}
                };
                CastController.getCast(swaggerReq,{}/*any res*/, () => {
                    expect(_saveResponseData).to.deep.equal(testResponseJSON);
                    done();
                });
            });
        });
    });
    describe('Check api/service/Cast.js', function(done) {
        describe('Check if everything is ok, expected response is received', function(done) {
            let _saveResponseData;
            let testResponseJSON = require('./default.json');
            let testDataFromDB = require('./default_unsorted.json');
            let $db, $getLogger, $config;
            let CastService;
            before(function () {
                $db = {
                    getShowsPage: (startId, pageSize) => {
                        return Promise.resolve(testDataFromDB);
                    }
                };
                $getLogger = function(moduleName) {
                    //ignore logs for now
                    return {
                        debug: () => {},
                        warn: () => {},
                        error: () => {},
                        fatal: () => {}
                    };
                };
                $config = require('../../config.js')(); // default config
                CastService = require('../../api/service/CastService.js')({
                    $db: $db,
                    $getLogger: $getLogger,
                    $config: $config}
                );
            });
            after(function () {
                delete require.cache[require.resolve('../../api/service/CastService.js')];
            });
            it('200 Ok with sorted cast is returned', function (done) {
                CastService.getCast(25,0)
                    .then(resp => {
                        expect(resp).to.deep.equal({
                            shows: testResponseJSON
                        });
                        done();
                    });
            });
            it('200 Ok with cast is returned with next_start_key if there is more data', function (done) {
                CastService.getCast(1,0)
                    .then(resp => {
                        expect(resp.next_start_key).to.deep.equal(4);
                        done();
                    });
            });
        });
    });
    describe('Check db/mongo/modelShow.js', function(done) {
        describe('Check how db connection is handled', function(done) {
            let $db, $getLogger, $config, $connection;
            let modelShow;
            before(function () {
                $getLogger = function(moduleName) {
                    //ignore logs for now
                    return {
                        debug: () => {},
                        warn: () => {},
                        error: () => {},
                        fatal: () => {}
                    };
                };
                $config = require('../../config.js')(); // default config
                $connection = {
                    isDbConnected: () => {
                        return false; // not connected
                    }
                };
                modelShow = require('../../db/mongo/modelShow.js')({
                    $connection: $connection,
                    $getLogger: $getLogger,
                    $config: $config}
                    // inject default mongoose dep
                );
            });
            after(function () {
                delete require.cache[require.resolve('../../api/service/CastService.js')];
            });
            it('Rejects if db connection is not established yet', function (done) {
                modelShow.saveShow({someShow:{}})
                    .catch(err => {
                        expect(err.message).to.equal("db not connected");
                        done();
                    });
            });
        });
    });
    describe('Check logger/logger.js', function(done) {
        describe('Check log format', function(done) {
            let $config;
            let logger;
            before(function () {
                $config = require('../../config.js')(); // default config
                logger = require('../../logger/logger.js')({
                    $config: $config}
                    // inject default log4js dep
                );
            });
            after(function () {
                delete require.cache[require.resolve('../../logger/logger.js')];
            });
            it('Check that it reflects passed module name', function (done) {
                let res = logger.getLogger("my_cool_module");
                expect(res.category).to.equal("my_cool_module");
                done();
            });
        });
    });
    describe('Check scraper/app.js', function(done) {
        describe('Check how it starts', function(done) {
            let $db, $getLogger, $config, $connection;
            let scraper;
            let recordLog;
            before(function () {
                $getLogger = function(moduleName) {
                    //ignore logs for now
                    return {
                        debug: () => {},
                        warn: () => {},
                        error: () => {},
                        fatal: (param1) => {
                            recordLog = param1;
                        }
                    };
                };
                $config = require('../../config.js')(); // default config
                $db = {
                    readGlobalState: () => {
                        return Promise.reject("db error");
                    }
                };
                scraper = require('../../scraper/app.js')({
                        $getLogger: $getLogger,
                        $config: $config,
                        $db: $db
                        // inject Bottleneck and rp default deps
                });
            });
            after(function () {
                delete require.cache[require.resolve('../../scraper/app.js')];
            });
            it('Check db is not ready or failure while reading state, just exit', function (done) {
                scraper.start();
                setImmediate(() => { // called after promise rejects
                    expect(recordLog.includes("Error while starting scraper task. Something is really bad.")).to.equal(true);
                    done();
                });
            });
        });
    });
    describe('Check api/app.js', function(done) {
        describe('Check how http starts', function(done) {
            let $getLogger, $config, $connect;
            let http;
            let recordLog;
            before(function () {
                $getLogger = function(moduleName) {
                    return {
                        debug: () => {},
                        warn: () => {},
                        error: () => {},
                        fatal: (param1) => {
                            recordLog = param1;
                        }
                    };
                };
                $config = require('../../config.js')(); // default config
                $connect = () => {throw new Error("some");}
            });
            after(function () {
                delete require.cache[require.resolve('../../api/app.js')];
            });
            it('Http server should gracefully shutdown upon uncaught exception', function (done) {
                let listeners = process.listeners('uncaughtException');
                process.removeAllListeners('uncaughtException');
                let sandbox, exitStub;
                sandbox = sinon.sandbox.create({useFakeTimers: true});
                exitStub = sandbox.stub(process, 'exit');
                process.nextTick(function () {
                    http = require('../../api/app.js')({
                        $getLogger: $getLogger,
                        $config: $config,
                        $connect: $connect
                        // inject the rest of default deps
                    });
                    http.start();
                });

                process.nextTick(function () {
                    expect(exitStub.called).to.equal(true);
                    process.removeAllListeners('uncaughtException');
                    listeners.forEach(function(listener) {
                        process.on('uncaughtException', listener);
                    });
                    sandbox.restore();
                    done();
                });
            });
        });
    });
}

runUnitTest();