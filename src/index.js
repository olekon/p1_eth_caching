//const node = 'http://localhost:8545';
const node = 'https://mainnet.infura.io/cyzlwMls9nnLIGFdysn7';

const mysql = require('mysql');
const util = require('util');
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(node));

//Binance coin / BNB
const contractAddress = '0x98bde3a768401260e7025faf9947ef1b81295519';
const abi = require('../eth/abi.js');
let contract = new web3.eth.Contract(abi, contractAddress);


const timeout = 5;

//---------------------------------------------------------------------------------------
// utilities

function sleep(milliseconds) {
   return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function poll (fn) {
   await fn();
   await sleep(timeout*1000);
   await poll(fn);
}

//---------------------------------------------------------------------------------------
// creating connection pool 
let pool = mysql.createPool({
    connectionLimit: 10,
    host: 'localhost',
    user: 'sa',
    password: '11111',
    database: 'eth_cache'
})

//it would be convenient to use promisified version of 'query' methods
pool.query = util.promisify(pool.query);
//---------------------------------------------------------------------------------------


//-------------------------------------------------------------------------------------------------
// database-related functions
async function writeEvent(event) {    
    try {
        delete event.raw;
        delete event.event;
        delete event.blockHash;
        delete event.type;
        delete event.id;
        delete event.signature;

        await pool.query(
            `Insert into \`transfer\` (\`json\`) VALUES (\'${JSON.stringify(event)}\')`
        );
    } catch(e) {
        //if it's 'duplicate record' error, do nothing, otherwise rethrow
        if(e.code != 'ER_DUP_ENTRY') {
            throw e; 
        }
    }   
}

async function getLatestCachedBlock() {
    const defaultInitialBlock = 4346682;
    
    let dbResult = await pool.query(
        'select json_unquote(json_extract(`json`,\'$.blockNumber\')) \
        as block from transfer order by id desc limit 1'
    );
    return dbResult.length > 0 ? parseInt(dbResult[0].block) : defaultInitialBlock;     
}

async function selectTransfersFrom(sender) {
    let dbResult = await pool.query(`select json from transfer t where t.from = \'${sender}\'`);
    return dbResult;
}

//-------------------------------------------------------------------------------------------------

async function cacheEvents(fromBlock, toBlock) {
    let events = await contract.getPastEvents(
        "Transfer",
        { filter: {}, fromBlock: fromBlock, toBlock: toBlock }
    );

    for(let event of events) {
        await writeEvent(event);
    }
}

async function initLatestCachedBlock() {
    
};

async function scan() {
    const MaxBlockRange = 500000;
    
    let latestCachedBlock = await getLatestCachedBlock(); // latest block written to database 
    let latestEthBlock = 0;   // latest block in blockchain

    await poll(async () => {
        try {
            //get latest block written to the blockchain
            latestEthBlock = await web3.eth.getBlockNumber();
            //divide huge block ranges to smaller chunks, of say 500000 blocks max
            latestEthBlock = Math.min(latestEthBlock, latestCachedBlock + MaxBlockRange);

            //if it is greater than cached block, search for events  
            if(latestEthBlock > latestCachedBlock) {
                await cacheEvents(latestCachedBlock, latestEthBlock);

                //if everything is OK, update cached block value                
                //we need +1 because cacheEvents function includes events in both fromBlock and toBlock as well
                //with latest cached block incremented by 1 we can be sure that next time events found by 
                // the 'cacheEvents' will be completely new  
                latestCachedBlock = latestEthBlock + 1;
            }
        } catch (e) {
            //we might want to add some simple logging here
            console.log(e.toString());
        }
    });
} 



// scan()
// .then(() => {
//     pool.end();
// })
// .catch(e => {
//     console.log(`Unexpected error. Work stopped. ${e}. ${e.stack}`);
//     pool.end();
// });

selectTransfersFrom('0xF20b9e713A33F61fA38792d2aFaF1cD30339126A')
.then(events => {
    console.log(events.length);
});
/*
getEvents(6813920, 6813923).
then(events => {
    console.log(events[0]);
});
*/