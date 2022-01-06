const bodyParser = require('body-parser');
const express = require('express');
const request = require('request');
const path = require('path');
const Blockchain = require('./blockchain');
const PubSub = require('./app/pubsub');
const Wallet = require('./wallet');
const TransactionPool = require('./wallet/transaction-pool');
const TransactionMiner = require('./app/transaction-miner');

const app = express();
const blockchain = new Blockchain();
const wallet = new Wallet();
const transactionPool = new TransactionPool();
const pubsub = new PubSub({ blockchain, transactionPool, wallet });
const transactionMiner = new TransactionMiner({blockchain,transactionPool,wallet,pubsub});

const DEFAULT_PORT=5000;
const ROOT_NODE_ADDRESS = `http://localhost:${DEFAULT_PORT}`

// setTimeout(() => pubsub.broadcastChain(), 1000);

app.use(bodyParser.json());

app.get('/api/blocks',(req,res)=>{
    res.json(blockchain.chain);
});

app.post('/api/mine',(req,res)=>{
    const { data } = req.body;

    blockchain.addBlock({ data });

    pubsub.broadcastChain();
    res.redirect('/api/blocks');
});

app.post('/api/transaction',(req,res)=>{
    const { amount,recipient } = req.body;

    let transaction = transactionPool.existingTransaction({inputAddress: wallet.publicKey});
    try{
        if(transaction) {
            transaction.update({ senderWallet:wallet,recipient,amount })
        } else {
            transaction = wallet.createTransaction({ recipient,amount,chain: blockchain.chain });
        }
    } catch(error){
        return res.status(400).json({type:'error',message: error.message});
    }

    transactionPool.setTransaction(transaction);

    pubsub.broadcastTransaction(transaction);

    console.log('Transaction POOL: ',transactionPool);

    res.json({ type:'success',transaction });
});

app.get('/api/transactions-pool',(req,res)=>{
    res.json(transactionPool.transactionMap);
});

app.get('/api/mine-transactions',(req,res)=>{
    transactionMiner.mineTransactions();
    res.redirect('/api/blocks');
});

app.get('/api/wallet-info',(req,res)=>{
    const address = wallet.publicKey;
    res.json({
        address,
        balance: Wallet.calculateBalance({chain:blockchain.chain,address})
    });
});

// function checkJSON(text) { 
//     if (typeof text !== "string") { 
//         return false; 
//     } 
//     try { 
//         JSON.parse(text); 
//         return true; 
//     } catch (error) { 
//         return false; 
//     } 
// }

// app.get('*',(req,res)=>{
//     res.sendFile(path.join(__dirname + 'client/index.html'))
// });

const syncWithRootStates = () => {
    request({ url: `${ROOT_NODE_ADDRESS}/api/blocks` },(error,response,body)=>{
        if (!error && response.statusCode===200) {
            const rootChain = JSON.parse(body);

            console.log("replace chain on a sync with",rootChain);
            blockchain.replaceChain(rootChain);
        }
    });

    request({url: `${ROOT_NODE_ADDRESS}/api/transactions-pool`},(error, response, body)=>{
        if (!error && response.statusCode===200) {
            const rootTransactionPoolMap = JSON.parse(body);

            console.log('replace transaction pool map on a sync with',rootTransactionPoolMap);
            transactionPool.setMap(rootTransactionPoolMap);
        }
    });
}

/* *****FOR FRONTEND DEVELOPMENT***** */
// const walletOne = new Wallet();
// const walletTwo = new Wallet();

// generateWalletTransaction = ({ wallet,recipient,amount }) => {
//     const transaction = wallet.createTransaction({
//         recipient,amount,chain: blockchain.chain
//     });

//     transactionPool.setTransaction(transaction);
// };

// const walletAction = () => {generateWalletTransaction({
//     wallet,recipient: walletOne.publicKey,amount: 10
// })};

// const walletOneAction = () => {generateWalletTransaction({
//     wallet: walletOne, recipient: walletTwo.publicKey, amount: 15
// })};

// const walletTwoAction = () => {generateWalletTransaction({
//     wallet: walletTwo, recipient: wallet.publicKey, amount: 20
// })};

// for (let i=0;i<10;i++) {
//     if (i%3===0) {
//         walletAction();
//         walletOneAction();
//     } else if (i%3===1) {
//         walletAction();
//         walletTwoAction();
//     } else {
//         walletOneAction();
//         walletTwoAction();
//     }

//     transactionMiner.mineTransactions();
// }

/* *****FOR FRONTEND DEVELOPMENT***** */

let PEER_PORT;
if (process.env.GENERATE_PEER_PORT==='true') {
    PEER_PORT = 3001 + Math.ceil(Math.random()*1000);
}
const PORT = PEER_PORT || DEFAULT_PORT;
app.listen(PORT,()=>{
    console.log(`server started on port: ${PORT}`);
    if (PORT !== DEFAULT_PORT) {
        syncWithRootStates();
    }
});