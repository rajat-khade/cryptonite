const Transaction = require('../wallet/transaction');

class TransactionMiner {
    constructor({ blockchain,transactionPool,wallet,pubsub }) {
        this.blockchain = blockchain;
        this.transactionPool = transactionPool;
        this.wallet = wallet;
        this.pubsub = pubsub;
    }

    mineTransactions() {
        //get valid transactions from pool
        const validTransactions = this.transactionPool.validTransactions();
        
        //generate the miner's reward
        validTransactions.push(
            Transaction.rewardTransaction({minerWallet: this.wallet})
        );
        
        //add a block with these transaction
        this.blockchain.addBlock({data: validTransactions});

        //broadcast the updated chain
        this.pubsub.broadcastChain();

        //clear pool
        this.transactionPool.clear();
    }
}

module.exports = TransactionMiner;