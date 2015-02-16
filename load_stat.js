var login_path = 'https://battlelog.battlefield.com/bf4/gate/login/';
var request = require('request'),
    MongoClient = require('mongodb').MongoClient,
    $weapons_collection,
    async = require('async');


var defaultHeaders = {
    'Origin': 'http://battlelog.battlefield.com',
    'Referer': 'http://battlelog.battlefield.com/bf4/servers/pc/',
    'User-Agent': 'Mozilla/5.0 (X11; Linux i686) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/29.0.1547.76 Safari/537.36',
    'X-AjaxNavigation': '1',
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': '*/*'
};

function loadServers(cb) {
    var path = 'http://battlelog.battlefield.com/bf4/servers/pc/?filtered=1&expand=0&settings=&useLocation=1&useAdvanced=-1&slots=1&q=&serverTypes=1&serverTypes=2&gamepresets=1&premium=-1&mapRotation=-1&modeRotation=-1&password=-1&vbdm-min=1&vbdm-max=500&vprt-min=10&vprt-max=300&vshe-min=50&vshe-max=500&vpmd-min=1&vpmd-max=300&vtkk-min=1&vtkk-max=99&vnit-min=120&vnit-max=900&vtkc-min=2&vtkc-max=15';
    request.get({
        url: path,
        json: true,
        headers: defaultHeaders
    }, function (error, response, body) {
        cb(error, body);
    });
}

function loadServerInfo(server, cb) {
    var server_id = server.guid;
    var path = 'http://battlelog.battlefield.com/bf4/servers/show/pc/' + server_id + '/';
    request.get({
        url: path,
        json: true,
        headers: defaultHeaders
    }, function (error, response, body) {
        cb(error, body);
    });
}

function loadPlayerStat(player, cb) {
    var player_id = player.personaId;
    var path = 'http://battlelog.battlefield.com/bf4/warsawWeaponsPopulateStats/' + player_id + '/1/stats/';
    request.get({
        url: path,
        json: true,
        headers: defaultHeaders
    }, function (error, response, body) {
        cb(error, body);
    });
}

MongoClient.connect('mongodb://127.0.0.1:27017/bf4', function(err, db) {
    if (err) throw err;
    $weapons_collection = db.collection('weapons');

    var server_info_queue = async.queue(function (server_item, callback) {
        loadServerInfo(server_item, function (err, server_info) {
            if (!err) {
                console.log('loaded server info for ' + server_item.guid);
                server_info.context.players.forEach(function (player) {
                    player_info_queue.push(player);
                });
            }
            callback();
        });
    }, 4);

    var player_info_queue = async.queue(function (player, callback) {
        async.waterfall([
            function (cb) {
                loadPlayerStat(player, cb);
            },
            function (player_stat, cb) {
                $weapons_collection.remove({personaId: player_stat.data.personaId}, function (err) {
                    cb(err, player_stat);
                });
            },
            function (player_stat, cb) {
                player_stat.data.mainWeaponStats.forEach(function (weapon) {
                    weapon.personaId = player_stat.data.personaId;
                    $weapons_collection.insert(weapon, function (err){});
                });
                cb(null, 'done');
            }
        ], function (err) {
           if (err) console.warn(err.message);
           console.log('added weapons stat for ' + player.personaId + ' (' + player_info_queue.length() + ')' );
           callback();
        });
    }, 10);

    loadServers(function (err, servers) {
        if (err) {
            console.warn(err.message);
            return;
        }
        servers.globalContext.servers.forEach(function (server) {
            server_info_queue.push(server);
        });
    });
});