const mysql = require('mysql');
const util = require('util');

let db = function(host, user, password, database, connectionLimit) {
    let pool = mysql.createPool({
        connectionLimit: connectionLimit,
        host: host,
        user: user,
        password: password,
        database: database
    });

    //it would be convenient to use promisified version of 'query' methods
    pool.query = util.promisify(pool.query);

    return pool;
};

module.exports = db;