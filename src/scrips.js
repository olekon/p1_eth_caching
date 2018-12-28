let events = await contract.getPastEvents(
    "Transfer",
    {
        filter: {from:'0x0123456789abcdef0123456789abcdef01234567'}, 
        fromBlock: 0, 
        toBlock: 'latest'
    }
);