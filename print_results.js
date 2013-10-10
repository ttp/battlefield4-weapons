var MongoClient = require('mongodb').MongoClient,
    _ = require('underscore'),
    Table = require('cli-table');

// configure settings
var MIN_TIME_EQUIPPED = 3600;
var FORMAT = 'console'; // [console, textile]

function cliTable (headers, records) {
    var table = new Table({ head: headers});
    records.forEach(function (item) {
        table.push([item._id.slug, item.accuracy.toFixed(3), item.kpm.toFixed(3), item.records]);
    });
    return table.toString();
}

function textileTable (headers, records) {
    var table = new Table({
        chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
         , 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
         , 'left': '|' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
         , 'right': '|' , 'right-mid': '' , 'middle': '|' },
        style: { 'padding-left': 1, 'padding-right': 1, compact : true }
    });
    table.push(_.map(headers, function (title) {return '*' + title + '*';}));
    records.forEach(function (item) {
        table.push([item._id.slug, item.accuracy.toFixed(3), item.kpm.toFixed(3), item.records]);
    });
    return table.toString();
};

var Printer = {
    'console' : {
        title : function (title) {return '--- ' + title + ' ---';},
        subtitle : function (title) {return '- ' + title + ' -';},
        table : cliTable
    },

    'textile' : {
        title : function (title) {return 'h3. ' + title;},
        subtitle : function (title) {return '**' + title + '**';},
        table : textileTable
    }
};

MongoClient.connect('mongodb://127.0.0.1:27017/bf4', function(err, db) {
    if (err) throw err;
    weapons = db.collection('weapons');
    weapons.aggregate({
        $match: { timeEquipped: { $gte: MIN_TIME_EQUIPPED } }
    }, {
        $group : {
            _id : { slug : "$slug", category : "$category" },
            accuracy : { $avg : "$accuracy" },
            totalKills : {$sum : "$kills"},
            totalTime : {$sum : "$timeEquipped"},
            records : {$sum : 1}
        }
    }, function (err, results) {
        var headers = ["Name", "Accuracy", "KPM", "Count"];
        var printer = Printer[FORMAT];
        results = _.map(results, function (result) {
            result.kpm = result.totalKills / (result.totalTime / 60);
            return result;
        });
        results = _.groupBy(results, function (item) {return item._id.category;});
        _.each(results, function (items, category) {
            console.log("\n\n" + printer.title(category));
            console.log("\n" + printer.subtitle('by accuracy'));
            console.log(printer.table(headers, _.sortBy(items, 'accuracy').reverse()));

            console.log(printer.subtitle('by kpm'));
            console.log(printer.table(headers, _.sortBy(items, 'kpm').reverse()));
        });
        db.close();
    });
});