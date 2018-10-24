/**
 * @brief Script to deploy mongoDB schema. Used to initially setup and then update db schema when necessary.
 * Important to track update changes. So use it instead of some auto configuration code in the app.
 */
'use strict';
var deployment = {};

function findAPrimary() {
    var primary;
    var replSet = rs.status();
    print('Found ' + replSet.members.length + ' members in replicaSet');
    for (var i = 0; i < replSet.members.length; i++) {
        print(replSet.members[i].name + ' with status ' + replSet.members[i].stateStr);
        if (replSet.members[i].stateStr === 'PRIMARY') {
            primary = replSet.members[i].name;
        }
    }
    return primary;
}

deployment.deploy = function (adminUsername, adminPass, dbName) {
    try {
        var primary = findAPrimary();
        print('Connecting to PRIMARY server');
        var db = connect(primary + '/admin');
        db.auth(adminUsername, adminPass);
        print('Creating user(s)');

        db = db.getSiblingDB(dbName);
        if (db.getUser('scraper') === null) {
            db.createUser({
                "user": "scraper",
                "pwd": "tvmaze",
                "customData": {"Description": "User for TVMaze scraper app"},
                "roles": [
                    {role: "readWrite", db: dbName}
                ]
            });
        }

        print('Done');
        var existing_collections = db.getCollectionNames();
        if (!isCollectionExist('shows', existing_collections)) {
            print('CREATE initial db structure');
            db.createCollection("shows");
            db.createCollection("global");
            db.shows.createIndex({id: 1});
            print('Done CREATING');
        }
        print('UPDATE the initial DB schema if necessary');
        updateSchema(db);
        print('Done UPDATING');
        print('-----------------------------------------------');
    }
    catch (e) {
        print('Exception :', e);
    }
};

function updateScraper(db) {
    // nothing for now
}

deployment.createAdmin = function (adminUsername, adminPass) {
    var primary = findAPrimary();
    print('Connecting to PRIMARY server messaging DB');
    var db = connect(primary + '/admin');
    db.createUser({"user": adminUsername, "pwd": adminPass, "customData": {"Description": "DBA account"}, "roles": [
        {role: "root", db: "admin"}
    ]});
};

function isCollectionExist(collName, existing_collections) {
    if (!Array.isArray(existing_collections)) return false;
    for (var i=0; i < existing_collections.length; i++) {
        if (existing_collections[i] === collName) return true;
    }
    return false;
}
